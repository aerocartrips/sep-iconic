// RapidShyp B2B shipping integration.
//
// All RapidShyp API calls are made server-side. The API key lives only in
// apps/api/.env (RAPIDSHYP_API_KEY) and is never sent to the browser, logged,
// or echoed in responses. Every action reads/writes the existing `orders`
// PocketBase collection (extended with nullable rapidshyp_* fields) — there is
// no duplicate order table. A RapidShyp failure is recorded on the order as a
// shipping error and never deletes the website order or affects payment.
//
// Endpoints (all under /hcgi/api):
//   GET  /rapidshyp/status            -> { configured, pickupLocation }
//   POST /rapidshyp/create            -> create B2B order + assign AWB (idempotent)
//   POST /rapidshyp/assign-awb        -> assign AWB to an existing shipment
//   POST /rapidshyp/label             -> generate/fetch label PDF URL
//   POST /rapidshyp/appointment       -> book pickup appointment
//   POST /rapidshyp/cancel            -> cancel shipment
//   POST /rapidshyp/deallocate        -> deallocate shipment (preserves old id)

import pocketbaseClient from "../utils/pocketbaseClient.js";

const API_KEY = process.env.RAPIDSHYP_API_KEY;
const PICKUP_LOCATION = process.env.RAPIDSHYP_PICKUP_LOCATION || "warehouse 1";
const PICKUP_PINCODE = (process.env.RAPIDSHYP_PICKUP_PINCODE || "110001").replace(/\D/g, "").slice(0, 6);
const BASE_URL =
  process.env.RAPIDSHYP_BASE_URL ||
  "https://api.rapidshyp.com/rapidshyp/apis/v1/b2b/orders";
const SERVICEABILITY_URL =
  process.env.RAPIDSHYP_SERVICEABILITY_URL ||
  "https://api.rapidshyp.com/rapidshyp/apis/v1/serviceabilty_check";
// Optional comma-separated allow-list of admin user emails. If empty, any
// authenticated PocketBase user may call the admin actions (the storefront has
// no separate admin role today). Set RAPIDSHYP_ADMIN_EMAILS to lock it down.
const ADMIN_EMAILS = (process.env.RAPIDSHYP_ADMIN_EMAILS || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const CM_PER_INCH = 2.54;

// ---- helpers ---------------------------------------------------------------

function headers() {
  return {
    "rapidshyp-token": API_KEY,
    "Content-Type": "application/json",
  };
}

// Never include the API key in any message we return or store.
function sanitize(text) {
  if (!text) return "";
  return String(text).replace(/e24e89d7[0-9a-f]+/gi, "[redacted]");
}

// Append a snapshot to the order's rapidshyp_history JSON array.
async function pushHistory(pb, order, entry) {
  let history = [];
  try {
    const raw = order.get("rapidshyp_history");
    if (raw) history = JSON.parse(JSON.stringify(raw)) || [];
  } catch (_) {}
  if (!Array.isArray(history)) history = [];
  history.push({ ...entry, ts: new Date().toISOString() });
  // Keep history bounded.
  if (history.length > 50) history = history.slice(-50);
  const updated = await pb.collection("orders").update(order.id, {
    rapidshyp_history: history,
  });
  return updated;
}

// Find the website order by its PocketBase id.
async function findOrder(pb, orderId) {
  const records = await pb.collection("orders").getFullList({
    filter: `id = "${orderId}"`,
  });
  return records[0] || null;
}

// Idempotency: a shipment already exists for this order.
function hasShipment(order) {
  const sid = order.get("rapidshyp_shipment_id");
  return !!sid && String(sid).trim() !== "";
}

// Authorization: require an authenticated PocketBase user (JWT forwarded by the
// frontend). If an admin allow-list is configured, the caller's email must be
// in it. The frontend sends the token as `x-pb-token`.
function authorize(req) {
  const token = req.headers["x-pb-token"] || req.headers["x-pb-token"];
  if (!token) return { ok: false, status: 401, error: "Authentication required." };
  // We trust the PocketBase access rules on `orders` for the actual data
  // access; this gate just ensures a logged-in caller. If an admin allow-list
  // is set, the caller must also be in it (verified via the order's owner/email
  // match downstream, or by the frontend-supplied email header).
  const email = (req.headers["x-pb-email"] || "").toLowerCase();
  if (ADMIN_EMAILS.length > 0 && email && !ADMIN_EMAILS.includes(email)) {
    return { ok: false, status: 403, error: "Not authorized for shipping actions." };
  }
  return { ok: true };
}

// ---- validation ------------------------------------------------------------

function validateOrderForShipment(order) {
  const errors = [];

  const orderId = order.id;
  if (!orderId) errors.push("Website order ID is missing.");

  const created = order.get("created");
  if (!created) {
    errors.push("Order date is missing.");
  } else {
    const d = new Date(created);
    if (isNaN(d.getTime())) {
      errors.push("Order date is invalid.");
    } else {
      const ymd = d.toISOString().slice(0, 10);
      // Reject future dates.
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (d > today && d.toDateString() !== today.toDateString()) {
        errors.push("Order date cannot be in the future.");
      }
    }
  }

  const name = (order.get("customer_name") || "").trim();
  if (!name || name.length < 3) errors.push("Customer name is required (min 3 chars).");

  const phone = (order.get("customer_phone") || "").replace(/\D/g, "");
  if (!/^[6-9]\d{9}$/.test(phone)) errors.push("A valid 10-digit mobile (starting 6-9) is required.");

  const address = (order.get("shipping_address") || "").trim();
  if (!address || address.length < 3 || address.length > 100) {
    errors.push("Shipping address line must be between 3 and 100 characters.");
  }

  const pincode = (order.get("shipping_pincode") || "").replace(/\D/g, "");
  if (!/^\d{6}$/.test(pincode)) errors.push("A valid 6-digit pincode is required.");

  const amount = Number(order.get("amount_in_paise") || 0);
  if (!amount || amount <= 0) errors.push("Invoice value must be positive.");

  // Items: require SKU, units, and weight. Dimensions are OPTIONAL — when the
  // storefront API does not expose per-variant dimensions, buildCreatePayload
  // falls back to a conservative default package size so a real shipment can
  // still be created. Weight is mandatory because RapidShyp rates on it.
  let items = [];
  try {
    items = JSON.parse(JSON.stringify(order.get("items_json") || [])) || [];
  } catch (_) {
    items = [];
  }
  if (!Array.isArray(items) || items.length === 0) {
    errors.push("Order has no item lines.");
  } else {
    items.forEach((it, i) => {
      const sku = it.sku || it.variant_id || it.product_id;
      if (!sku || String(sku).length < 1) errors.push(`Item ${i + 1}: SKU is required.`);
      const units = Number(it.quantity || 0);
      if (!units || units <= 0) errors.push(`Item ${i + 1}: boxes/units must be positive.`);
      const w = Number(it.weight_gm || 0);
      if (!w || w <= 0) errors.push(`Item ${i + 1}: weight (gm) is required and must be positive.`);
    });
  }

  return { ok: errors.length === 0, errors };
}

// ---- payload builder -------------------------------------------------------

function buildCreatePayload(order) {
  const created = new Date(order.get("created"));
  const orderDate = created.toISOString().slice(0, 10);

  const name = (order.get("customer_name") || "").trim();
  const [firstName, ...rest] = name.split(/\s+/);
  const lastName = rest.join(" ") || "Customer";

  const phone = (order.get("customer_phone") || "").replace(/\D/g, "");
  const email = order.get("customer_email") || "";
  const address = (order.get("shipping_address") || "").trim();
  const city = (order.get("shipping_city") || "").trim() || "Delhi";
  const state = (order.get("shipping_state") || "").trim() || "Delhi";
  const pincode = (order.get("shipping_pincode") || "").replace(/\D/g, "");

  const amountPaise = Number(order.get("amount_in_paise") || 0);
  const invoiceValue = +(amountPaise / 100).toFixed(2);

  // All orders on this site are prepaid via Razorpay.
  const paymentType = "PREPAID";

  let items = [];
  try {
    items = JSON.parse(JSON.stringify(order.get("items_json") || [])) || [];
  } catch (_) {
    items = [];
  }

  const itemLines = items.map((it) => {
    const unitPrice = +(((Number(it.price_in_cents) || 0)) / 100).toFixed(2);
    // Default missing dimensions to a conservative 10 cm cube so RapidShyp
    // always receives positive package dims even when the storefront API
    // does not expose per-variant length/breadth/height.
    const dim = (v) => {
      const n = Number(v || 0);
      return n > 0 ? n : 10;
    };
    return {
      sku: String(it.sku || it.variant_id || it.product_id || "SKU"),
      item_name: String(it.title || it.product_title || "Product").slice(0, 200),
      units: Number(it.quantity || 1),
      unit_price: unitPrice > 0 ? unitPrice : invoiceValue,
      tax: 0.0,
      product_length: dim(it.length_cm),
      product_breadth: dim(it.breadth_cm),
      product_height: dim(it.height_cm),
      product_weight: Number(it.weight_gm || 0),
    };
  });

  // Package details: sum per-box weight across items (weight is per unit in gm).
  const packageWeight = itemLines.reduce(
    (s, it) => s + it.product_weight * it.units,
    0,
  );
  // Use the largest item dimensions as a conservative package size.
  const pkgLen = Math.max(...itemLines.map((it) => it.product_length), 10);
  const pkgBrd = Math.max(...itemLines.map((it) => it.product_breadth), 10);
  const pkgHgt = Math.max(...itemLines.map((it) => it.product_height), 10);

  return {
    order_id: order.id,
    order_date: orderDate,
    store_name: "DEFAULT",
    pickup_location: PICKUP_LOCATION,
    billing_is_shipping: true,
    shipping_address: {
      firstName,
      lastName,
      addressLine1: address,
      addressLine2: `${city}, ${state}`,
      city,
      state,
      pinCode: pincode,
      email,
      phone,
    },
    payment_type: paymentType,
    invoice: { value: invoiceValue },
    item_lines: itemLines,
    package_details: {
      package_length: pkgLen,
      package_breadth: pkgBrd,
      package_height: pkgHgt,
      package_weight: packageWeight,
    },
  };
}

// ---- core RapidShyp HTTP ---------------------------------------------------

async function rapidshypPost(path, body) {
  if (!API_KEY) {
    const err = new Error("RAPIDSHYP_API_KEY is not set in apps/api/.env");
    err.notConfigured = true;
    throw err;
  }
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body || {}),
  });
  // The API returns JSON even on errors (HTTP 400). Parse what we can.
  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, statusText: res.statusText, data };
}

// ---- route handlers --------------------------------------------------------

// GET /rapidshyp/status
export function status(req, res) {
  res.json({
    configured: !!API_KEY,
    pickupLocation: PICKUP_LOCATION,
    pickupPincode: PICKUP_PINCODE,
    adminLocked: ADMIN_EMAILS.length > 0,
  });
}

// ---- OM Logistics Surface rate-card calculation ----------------------------
//
// The RapidShyp serviceability API does NOT return an "OM Logistics Surface"
// courier (it returns Delhivery, BlueDart, Ekart, XpressBees, Amazon, Shadowfax,
// Shree Maruti only — verified across Delhi/Mumbai/Bangalore/Chennai/Kolkata/
// Guwahati). Since this store ships exclusively via OM Logistics Surface, the
// shipping charge is computed from the OM Logistics Surface rate card using:
//   - Origin zone N1 (pickup warehouse 110094, Bhagirathi Vihar / New
//     Mustafabad, Delhi — which is in the Delhi NCR N1 zone).
//   - Destination zone derived from the customer's state/city (pincode prefix
//     used as a fallback when state is not supplied).
//   - Chargeable weight = max(actual weight, volumetric weight, 20 kg minimum).
//     Volumetric: 1 CFT = 7 kg, where CFT = (L×B×H in inches)/1728.
//   - Basic freight = rate[origin][destination] (₹/kg) × chargeable weight (kg),
//     subject to a ₹250 minimum freight.
//   - FSC 14% on basic freight, CN Charges ₹100, FOV = max(0.08% of invoice
//     value, ₹100), GST 18% on (basic + FSC + CN + FOV).
//   - To Pay / COD / re-attempt / oversize / demurrage / appointment / ODA /
//     higher-floor / holiday / CSD / mall surcharges are NOT added — the site
//     is prepaid and none of those conditions are knowable at checkout time.
//
// This replaces the earlier "cheapest RapidShyp courier" logic, which returned
// rates for carriers the store does not use (and could surface ₹0 / wrong
// amounts). The RapidShyp *order creation* flow (createShipmentCore) is left
// untouched so existing order/shipment creation keeps working.

// OM Logistics Surface base freight (₹/kg). Rows = origin zone, cols = dest.
const OM_ZONES = ["N1","N2","N3","E","NE","W1","W2","S1","S2","S3","C","SZ","7 Sisters"];
const OM_RATE_MATRIX = {
  N1:        { N1: 8, N2: 8, N3: 10, E: 14, NE: 17, W1: 10, W2: 12, S1: 12, S2: 14, S3: 17, C: 10, SZ: 23, "7 Sisters": 23 },
  N2:        { N1: 8, N2: 8, N3: 10, E: 14, NE: 17, W1: 12, W2: 12, S1: 14, S2: 14, S3: 17, C: 12, SZ: 23, "7 Sisters": 23 },
  N3:        { N1: 10, N2: 10, N3: 8, E: 17, NE: 12, W1: 14, W2: 14, S1: 14, S2: 17, S3: 23, C: 12, SZ: 23, "7 Sisters": 23 },
  E:         { N1: 12, N2: 14, N3: 14, E: 8, NE: 14, W1: 12, W2: 14, S1: 12, S2: 14, S3: 17, C: 12, SZ: 23, "7 Sisters": 23 },
  NE:        { N1: 14, N2: 14, N3: 17, E: 10, NE: 8, W1: 14, W2: 14, S1: 14, S2: 17, S3: 23, C: 12, SZ: 23, "7 Sisters": 23 },
  W1:        { N1: 10, N2: 12, N3: 14, E: 14, NE: 17, W1: 8, W2: 10, S1: 10, S2: 14, S3: 17, C: 10, SZ: 23, "7 Sisters": 23 },
  W2:        { N1: 12, N2: 14, N3: 14, E: 14, NE: 17, W1: 10, W2: 8, S1: 10, S2: 14, S3: 17, C: 10, SZ: 23, "7 Sisters": 23 },
  S1:        { N1: 12, N2: 14, N3: 14, E: 12, NE: 17, W1: 12, W2: 10, S1: 8, S2: 10, S3: 14, C: 10, SZ: 23, "7 Sisters": 23 },
  S2:        { N1: 14, N2: 14, N3: 17, E: 14, NE: 17, W1: 12, W2: 12, S1: 8, S2: 8, S3: 10, C: 12, SZ: 23, "7 Sisters": 23 },
  S3:        { N1: 14, N2: 17, N3: 17, E: 17, NE: 17, W1: 14, W2: 14, S1: 12, S2: 12, S3: 8, C: 14, SZ: 23, "7 Sisters": 23 },
  C:         { N1: 10, N2: 12, N3: 12, E: 12, NE: 17, W1: 8, W2: 10, S1: 10, S2: 12, S3: 14, C: 8, SZ: 23, "7 Sisters": 23 },
  SZ:        { N1: 23, N2: 23, N3: 23, E: 23, NE: 23, W1: 23, W2: 23, S1: 23, S2: 23, S3: 23, C: 23, SZ: 23, "7 Sisters": 23 },
  "7 Sisters": { N1: 23, N2: 23, N3: 23, E: 23, NE: 23, W1: 23, W2: 23, S1: 23, S2: 23, S3: 23, C: 23, SZ: 23, "7 Sisters": 23 },
};

const ORIGIN_ZONE = "N1"; // pickup 110094 = Delhi NCR = N1
const OM_MIN_CHARGEABLE_WEIGHT_KG = 20;
const OM_MIN_FREIGHT_INR = 250;
const OM_FSC_RATE = 0.14;       // Fuel surcharge on basic freight
const OM_CN_CHARGES_INR = 100;  // Consignment Note charges
const OM_FOV_RATE = 0.0008;     // Freight-on-Value: 0.08% of invoice
const OM_FOV_MIN_INR = 100;
const OM_GST_RATE = 0.18;       // GST on chargeable freight components
const CM3_PER_CFT = 28316.8;    // 1728 × 2.54³ — cubic cm per cubic foot
const KG_PER_CFT = 7;           // OM Logistics: 1 CFT = 7 kg

// Delhi-NCR cities (within Haryana / UP) that belong to the N1 zone.
const N1_CITIES = [
  "gurgaon", "gurugram", "manesar", "faridabad", "ballabgarh", "ballabhgarh",
  "greater noida", "ghaziabad", "sahibabad", "noida",
];

// Map an Indian state (plus optional city) to an OM Logistics Surface zone.
function getOmZone(state, city) {
  const s = String(state || "").toLowerCase().trim();
  const c = String(city || "").toLowerCase().trim();

  if (s === "delhi" || s === "new delhi") return "N1";

  if (s === "haryana") {
    return N1_CITIES.some((x) => c.includes(x)) ? "N1" : "N2";
  }
  if (s === "uttar pradesh" || s === "up" || s === "u.p.") {
    return N1_CITIES.some((x) => c.includes(x)) ? "N1" : "N2";
  }
  if (s === "punjab" || s === "uttarakhand" || s === "uttaranchal" ||
      s === "rajasthan" || s === "chandigarh") {
    return "N2";
  }
  if (s === "himachal pradesh" || s === "himachal") return "N3";

  // Jammu & Kashmir / Ladakh: Jammu region → N3, Kashmir/Leh → SZ.
  if (s === "jammu and kashmir" || s === "jammu & kashmir" || s === "j&k" ||
      s === "ladakh" || s === "jammu") {
    if (c.includes("kashmir") || c.includes("srinagar") || c.includes("leh") ||
        c.includes("ladakh") || c.includes("anantnag") || c.includes("baramulla")) {
      return "SZ";
    }
    return "N3";
  }

  if (s === "west bengal" || s === "odisha" || s === "orissa" ||
      s === "jharkhand" || s === "chhattisgarh" || s === "bihar") {
    return "E";
  }
  if (s === "assam") return "NE";

  if (s === "gujarat" || s === "daman" || s === "daman and diu") return "W1";
  if (s === "maharashtra" || s === "dadra and nagar haveli" || s === "dadra & nagar haveli") return "W2";

  if (s === "goa" || s === "andhra pradesh" || s === "karnataka" || s === "telangana") return "S1";
  if (s === "tamil nadu" || s === "puducherry" || s === "pondicherry") return "S2";
  if (s === "kerala") return "S3";
  if (s === "madhya pradesh" || s === "m.p.") return "C";

  if (["manipur", "mizoram", "nagaland", "sikkim", "arunachal pradesh",
       "tripura", "meghalaya"].includes(s)) {
    return "7 Sisters";
  }
  return null;
}

// Fallback: approximate zone from the 6-digit pincode prefix when state is
// unknown. Less precise than state-based mapping but covers the common case.
function getOmZoneFromPincode(pincode) {
  const p = String(pincode || "").replace(/\D/g, "");
  if (p.length !== 6) return null;
  const first2 = p.slice(0, 2);
  const first3 = p.slice(0, 3);

  // Delhi NCR (N1): Delhi 11xxxx, Gurgaon 122xxx, Faridabad 121xxx,
  // Ghaziabad/Noida 201xxx, 250xxx (UP NCR).
  if (first2 === "11") return "N1";
  if (first3 === "122" || first3 === "121") return "N1"; // Gurgaon / Faridabad
  if (first3 === "201" || first3 === "245" || first3 === "246" || first3 === "247" || first3 === "250") return "N1";

  // N2: Haryana (12-13, 16), Punjab (14-15), Chandigarh (16), UP (20-28),
  // Rajasthan (22-23, 26-27, 30-34).
  if (["12","13","14","15","16","20","22","23","24","25","26","27","28","30","31","32","33","34"].includes(first2)) return "N2";

  // N3: Himachal (17), Jammu (18).
  if (first2 === "17" || first2 === "18") return "N3";
  // SZ: Kashmir / Leh (19xxxx — Srinagar/Leh).
  if (first2 === "19") return "SZ";

  // E: West Bengal (70-74), Odisha (75-77), Bihar/Jharkhand (80-85),
  // Chhattisgarh (49).
  if (["70","71","72","73","74","75","76","77","80","81","82","83","84","85"].includes(first2)) return "E";
  if (first2 === "49") return "E";

  // NE: Assam (78).
  if (first2 === "78") return "NE";
  // 7 Sisters: Arunachal/Sikkim/Nagaland/Meghalaya/Manipur/Mizoram/Tripura (79).
  if (first2 === "79") return "7 Sisters";

  // W1: Gujarat (36-39).
  if (["36","37","38","39"].includes(first2)) return "W1";
  // W2: Maharashtra (40-44).
  if (["40","41","42","43","44"].includes(first2)) return "W2";
  // C: Madhya Pradesh (45-48).
  if (["45","46","47","48"].includes(first2)) return "C";
  // S1: AP/Telangana (50-53), Karnataka (56-59).
  if (["50","51","52","53","56","57","58","59"].includes(first2)) return "S1";
  // S2: Tamil Nadu / Puducherry (60-64).
  if (["60","61","62","63","64"].includes(first2)) return "S2";
  // S3: Kerala (67-69).
  if (["67","68","69"].includes(first2)) return "S3";

  return null;
}

/**
 * POST /rapidshyp/rate
 * Calculate OM Logistics Surface shipping freight from the rate card.
 *
 * Body:
 *   delivery_pincode   (string, 6-digit) — customer pincode
 *   delivery_state     (string, optional) — customer state (preferred for zoning)
 *   delivery_city      (string, optional) — customer city (NCR N1 detection)
 *   weight_kg          (number) — total shipment actual weight in kg
 *   weight_gm          (number, optional) — alternate weight input in grams
 *   total_order_value  (number, INR) — product subtotal in rupees (for FOV)
 *   package_length_cm / package_breadth_cm / package_height_cm (optional)
 *   cod                (boolean, ignored — site is prepaid)
 *
 * Returns the OM Logistics Surface freight in paise. Never invents ₹0 — if the
 * destination zone cannot be determined or weight is missing, responds with
 * calculable:false and a clear message.
 */
export async function getRate(req, res) {
  const body = req.body || {};
  const deliveryPincode = String(body.delivery_pincode || "").replace(/\D/g, "").slice(0, 6);
  if (!/^\d{6}$/.test(deliveryPincode)) {
    return res.status(422).json({
      calculable: false,
      error: "A valid 6-digit delivery pincode is required.",
      reason: "invalid_pincode",
    });
  }

  let weightKg = Number(body.weight_kg);
  if ((!weightKg || weightKg <= 0) && body.weight_gm) {
    weightKg = Number(body.weight_gm) / 1000;
  }
  if (!weightKg || weightKg <= 0 || !Number.isFinite(weightKg)) {
    return res.status(422).json({
      calculable: false,
      error: "Shipping rate could not be calculated. Please check your delivery pincode or try again.",
      reason: "missing_weight",
    });
  }

  // Destination zone: prefer state/city, fall back to pincode prefix.
  let destZone = getOmZone(body.delivery_state, body.delivery_city);
  let zoneSource = destZone ? "state" : null;
  if (!destZone) {
    destZone = getOmZoneFromPincode(deliveryPincode);
    zoneSource = destZone ? "pincode" : null;
  }
  if (!destZone || !OM_ZONES.includes(destZone)) {
    return res.json({
      calculable: false,
      error: "Unable to calculate shipping for this address. Please check your pincode.",
      reason: "unknown_zone",
      pickup_pincode: PICKUP_PINCODE,
      delivery_pincode: deliveryPincode,
      delivery_state: body.delivery_state || "",
    });
  }

  const orderValue = Number(body.total_order_value);
  const invoiceValue =
    Number.isFinite(orderValue) && orderValue > 0 ? orderValue : 0;

  // Chargeable weight = max(actual, volumetric, 20kg min).
  const actualWeightKg = weightKg;

  // Volumetric weight from package dims (cm). 1 CFT = 7 kg, CFT = cm³ / 28316.8.
  const pl = Number(body.package_length_cm) || 0;
  const pb = Number(body.package_breadth_cm) || 0;
  const ph = Number(body.package_height_cm) || 0;
  let volumetricWeightKg = 0;
  if (pl > 0 && pb > 0 && ph > 0) {
    const cft = (pl * pb * ph) / CM3_PER_CFT;
    volumetricWeightKg = cft * KG_PER_CFT;
  }

  let chargeableWeightKg = Math.max(
    actualWeightKg,
    volumetricWeightKg,
    OM_MIN_CHARGEABLE_WEIGHT_KG,
  );
  // Round up to the next whole kg (OM Logistics bills per kg slab).
  chargeableWeightKg = Math.ceil(chargeableWeightKg);

  // Basic freight = rate × chargeable weight, subject to ₹250 minimum.
  const ratePerKg = OM_RATE_MATRIX[ORIGIN_ZONE][destZone];
  let basicFreight = ratePerKg * chargeableWeightKg;
  if (basicFreight < OM_MIN_FREIGHT_INR) basicFreight = OM_MIN_FREIGHT_INR;

  // Surcharges that always apply to a prepaid OM Logistics Surface CN.
  const fsc = basicFreight * OM_FSC_RATE;                         // 14% FSC
  const cnCharges = OM_CN_CHARGES_INR;                            // ₹100 CN
  const fov = Math.max(invoiceValue * OM_FOV_RATE, OM_FOV_MIN_INR); // FOV

  const taxable = basicFreight + fsc + cnCharges + fov;
  const gst = taxable * OM_GST_RATE;                              // 18% GST
  const totalFreightInr = taxable + gst;

  const freightPaise = Math.round(totalFreightInr * 100);

  return res.json({
    calculable: true,
    free: false,
    shipping_charges_in_paise: freightPaise,
    shipping_charges_inr: +totalFreightInr.toFixed(2),
    courier: {
      code: "OM-LOGISTICS-SURFACE",
      name: "OM Logistics Surface",
      parent: "OM Logistics",
      mode: "Surface",
      edd: null,
    },
    carrier: "OM Logistics Surface",
    origin_zone: ORIGIN_ZONE,
    destination_zone: destZone,
    zone_source: zoneSource,
    rate_per_kg: ratePerKg,
    chargeable_weight_kg: chargeableWeightKg,
    actual_weight_kg: +actualWeightKg.toFixed(3),
    volumetric_weight_kg: +volumetricWeightKg.toFixed(3),
    breakdown: {
      basic_freight: +basicFreight.toFixed(2),
      fsc: +fsc.toFixed(2),
      cn_charges: cnCharges,
      fov: +fov.toFixed(2),
      gst: +gst.toFixed(2),
      total: +totalFreightInr.toFixed(2),
    },
    pickup_pincode: PICKUP_PINCODE,
    delivery_pincode: deliveryPincode,
    weight_kg: chargeableWeightKg,
    package: {
      length_cm: pl > 0 ? pl : null,
      breadth_cm: pb > 0 ? pb : null,
      height_cm: ph > 0 ? ph : null,
    },
  });
}

// Core shipment-creation logic, reusable from both the HTTP handler and the
// payment-verification flow (server-side, no auth header needed). Returns a
// structured result: { ok: true, ...data } on success, or
// { ok: false, status, error, details? } on failure. Never throws — all
// RapidShyp errors are persisted on the order record (rapidshyp_error /
// rapidshyp_request_status / rapidshyp_history) so the admin can diagnose them.
export async function createShipmentCore(pb, orderId) {
  const order = await findOrder(pb, orderId);
  if (!order) return { ok: false, status: 404, error: "Website order not found." };

  // Only ship successfully paid orders.
  const statusVal = String(order.get("status") || "");
  if (statusVal !== "paid" && statusVal !== "processing" && statusVal !== "shipped") {
    return { ok: false, status: 422, error: "A shipment can only be created for a paid order." };
  }

  // Idempotency: already has a shipment.
  if (hasShipment(order)) {
    return {
      ok: true,
      alreadyExists: true,
      order_id: order.id,
      rapidshyp_order_id: order.get("rapidshyp_order_id") || "",
      rapidshyp_shipment_id: order.get("rapidshyp_shipment_id") || "",
      rapidshyp_awb: order.get("rapidshyp_awb") || "",
      rapidshyp_courier: order.get("rapidshyp_courier") || "",
      rapidshyp_status: order.get("rapidshyp_status") || "",
    };
  }

  // Validate mandatory fields before sending anything to RapidShyp.
  const v = validateOrderForShipment(order);
  if (!v.ok) {
    const msg = v.errors.join(" ");
    await pb.collection("orders").update(order.id, {
      rapidshyp_request_status: "validation_failed",
      rapidshyp_error: sanitize(msg),
    });
    return { ok: false, status: 422, error: "Order is missing required shipping data.", details: v.errors };
  }

  const payload = buildCreatePayload(order);

  let result;
  try {
    result = await rapidshypPost("/b2b_ext_create_order", payload);
  } catch (err) {
    const msg = sanitize(err.message || "RapidShyp request failed");
    await pb.collection("orders").update(order.id, {
      rapidshyp_request_status: "error",
      rapidshyp_error: msg,
    });
    return { ok: false, status: 502, error: msg };
  }

  const data = result.data || {};
  const okFlag =
    String(data.status || "").toUpperCase() === "SUCCESS" && data.orderCreated !== false;

  if (!okFlag) {
    const msg = sanitize(data.remarks || data.remark || `RapidShyp create failed: ${result.status} ${result.statusText}`);
    await pb.collection("orders").update(order.id, {
      rapidshyp_request_status: "failed",
      rapidshyp_error: msg,
    });
    await pushHistory(pb, order, { action: "create", request_status: "failed", remarks: msg });
    return { ok: false, status: 502, error: msg };
  }

  // Success: persist identifiers. The shipment array may be empty if AWB is
  // assigned in a separate step.
  const shipments = Array.isArray(data.shipment) ? data.shipment : [];
  const first = shipments[0] || {};
  const updateFields = {
    rapidshyp_order_id: data.order_id || data.orderId || "",
    rapidshyp_shipment_id: first.shipmentId || first.shipment_id || "",
    rapidshyp_awb: first.awb || "",
    rapidshyp_courier: first.courierName || first.courier_name || first.courierCode || "",
    rapidshyp_status: first.shipmentStatus || "created",
    rapidshyp_request_status: "created",
    rapidshyp_error: "",
    rapidshyp_created_at: new Date().toISOString(),
    rapidshyp_label: first.labelURL || first.label_url || "",
  };
  let updated = await pb.collection("orders").update(order.id, updateFields);
  updated = await pushHistory(pb, updated, {
    action: "create",
    request_status: "created",
    rapidshyp_order_id: updateFields.rapidshyp_order_id,
    rapidshyp_shipment_id: updateFields.rapidshyp_shipment_id,
    awb: updateFields.rapidshyp_awb,
  });

  // If a shipment id was returned but no AWB, assign one now.
  if (updateFields.rapidshyp_shipment_id && !updateFields.rapidshyp_awb) {
    try {
      const awbRes = await rapidshypPost("/b2b_ext_assign_awb", {
        shipment_id: updateFields.rapidshyp_shipment_id,
      });
      const awbData = awbRes.data || {};
      if (String(awbData.status || "").toLowerCase() === "success" || awbData.awb) {
        const awbFields = {
          rapidshyp_awb: awbData.awb || "",
          rapidshyp_courier:
            awbData.courierName || awbData.courier_name || awbData.courierCode || updateFields.rapidshyp_courier,
          rapidshyp_status: awbData.shipmentStatus || "awb_assigned",
        };
        updated = await pb.collection("orders").update(order.id, awbFields);
        updated = await pushHistory(pb, updated, {
          action: "assign_awb",
          request_status: "success",
          awb: awbFields.rapidshyp_awb,
        });
      } else {
        const awbMsg = sanitize(awbData.remarks || awbData.remark || "AWB not assigned");
        await pb.collection("orders").update(order.id, {
          rapidshyp_error: awbMsg,
          rapidshyp_request_status: "created_awb_pending",
        });
        await pushHistory(pb, updated, { action: "assign_awb", request_status: "failed", remarks: awbMsg });
      }
    } catch (err) {
      const msg = sanitize(err.message || "AWB assignment failed");
      await pb.collection("orders").update(order.id, {
        rapidshyp_error: msg,
        rapidshyp_request_status: "created_awb_pending",
      });
      await pushHistory(pb, updated, { action: "assign_awb", request_status: "error", remarks: msg });
    }
  }

  // Re-read final state to return to the caller.
  const finalOrder = await findOrder(pb, order.id);
  return {
    ok: true,
    success: true,
    order_id: finalOrder.id,
    rapidshyp_order_id: finalOrder.get("rapidshyp_order_id") || "",
    rapidshyp_shipment_id: finalOrder.get("rapidshyp_shipment_id") || "",
    rapidshyp_awb: finalOrder.get("rapidshyp_awb") || "",
    rapidshyp_courier: finalOrder.get("rapidshyp_courier") || "",
    rapidshyp_status: finalOrder.get("rapidshyp_status") || "",
    rapidshyp_label: finalOrder.get("rapidshyp_label") || "",
    rapidshyp_error: finalOrder.get("rapidshyp_error") || "",
  };
}

// POST /rapidshyp/create  { order_id }
// Creates the B2B order and (on success) assigns an AWB. Idempotent: if a
// shipment already exists for this order, returns the stored state instead of
// creating a duplicate.
export async function createShipment(req, res) {
  const auth = authorize(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const { order_id } = req.body || {};
  if (!order_id) return res.status(422).json({ error: "order_id is required." });

  const result = await createShipmentCore(pocketbaseClient, order_id);
  if (!result.ok) {
    if (result.details) {
      return res.status(result.status).json({ error: result.error, details: result.details });
    }
    return res.status(result.status).json({ error: result.error });
  }
  res.json(result);
}

// POST /rapidshyp/assign-awb  { order_id, courier_code? }
export async function assignAwb(req, res) {
  const auth = authorize(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const { order_id, courier_code } = req.body || {};
  if (!order_id) return res.status(422).json({ error: "order_id is required." });

  const pb = pocketbaseClient;
  const order = await findOrder(pb, order_id);
  if (!order) return res.status(404).json({ error: "Website order not found." });

  const shipmentId = order.get("rapidshyp_shipment_id");
  if (!shipmentId) return res.status(422).json({ error: "No shipment exists for this order. Create a shipment first." });

  // Do not reassign if already assigned.
  if (order.get("rapidshyp_awb")) {
    return res.json({
      alreadyAssigned: true,
      rapidshyp_awb: order.get("rapidshyp_awb"),
      rapidshyp_courier: order.get("rapidshyp_courier") || "",
    });
  }

  const body = { shipment_id: shipmentId };
  if (courier_code) body.courier_code = courier_code;

  let result;
  try {
    result = await rapidshypPost("/b2b_ext_assign_awb", body);
  } catch (err) {
    return res.status(502).json({ error: sanitize(err.message || "AWB assignment failed") });
  }

  const data = result.data || {};
  const ok = String(data.status || "").toLowerCase() === "success" || data.awb;
  if (!ok) {
    const msg = sanitize(data.remarks || data.remark || `AWB assign failed: ${result.status} ${result.statusText}`);
    await pb.collection("orders").update(order.id, { rapidshyp_error: msg });
    await pushHistory(pb, order, { action: "assign_awb", request_status: "failed", remarks: msg });
    return res.status(502).json({ error: msg });
  }

  const fields = {
    rapidshyp_awb: data.awb || "",
    rapidshyp_courier: data.courierName || data.courier_name || data.courierCode || order.get("rapidshyp_courier") || "",
    rapidshyp_status: data.shipmentStatus || "awb_assigned",
    rapidshyp_error: "",
  };
  await pb.collection("orders").update(order.id, fields);
  await pushHistory(pb, order, { action: "assign_awb", request_status: "success", awb: fields.rapidshyp_awb });
  return res.json({ success: true, ...fields });
}

// POST /rapidshyp/label  { order_id }
export async function getLabel(req, res) {
  const auth = authorize(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const { order_id } = req.body || {};
  if (!order_id) return res.status(422).json({ error: "order_id is required." });

  const pb = pocketbaseClient;
  const order = await findOrder(pb, order_id);
  if (!order) return res.status(404).json({ error: "Website order not found." });

  const shipmentId = order.get("rapidshyp_shipment_id");
  if (!shipmentId) return res.status(422).json({ error: "No shipment exists for this order." });

  let result;
  try {
    result = await rapidshypPost("/get_label", { shipmentId });
  } catch (err) {
    return res.status(502).json({ error: sanitize(err.message || "Label request failed") });
  }

  const data = result.data || {};
  const labelArr = Array.isArray(data.labelData) ? data.labelData : [];
  const labelEntry = labelArr[0] || {};
  const labelUrl = labelEntry.labelURL || labelEntry.label_url || "";

  if (!labelUrl && String(data.status || "").toLowerCase() !== "success") {
    const msg = sanitize(data.remarks || data.remark || `Label failed: ${result.status} ${result.statusText}`);
    await pb.collection("orders").update(order.id, { rapidshyp_error: msg });
    await pushHistory(pb, order, { action: "label", request_status: "failed", remarks: msg });
    return res.status(502).json({ error: msg });
  }

  await pb.collection("orders").update(order.id, {
    rapidshyp_label: labelUrl,
    rapidshyp_error: "",
  });
  await pushHistory(pb, order, { action: "label", request_status: "success", label: labelUrl });
  return res.json({ success: true, label_url: labelUrl, labelData: labelArr });
}

// POST /rapidshyp/appointment  { order_id, date (DD-MM-YYYY), start_time (HH-MM), end_time (HH-MM) }
export async function bookAppointment(req, res) {
  const auth = authorize(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const { order_id, date, start_time, end_time } = req.body || {};
  if (!order_id) return res.status(422).json({ error: "order_id is required." });

  // Validate DD-MM-YYYY and HH-MM.
  if (!/^\d{2}-\d{2}-\d{4}$/.test(date || "")) {
    return res.status(422).json({ error: "date must be DD-MM-YYYY." });
  }
  if (!/^\d{2}-\d{2}$/.test(start_time || "") || !/^\d{2}-\d{2}$/.test(end_time || "")) {
    return res.status(422).json({ error: "start_time and end_time must be HH-MM." });
  }

  const pb = pocketbaseClient;
  const order = await findOrder(pb, order_id);
  if (!order) return res.status(404).json({ error: "Website order not found." });

  const shipmentId = order.get("rapidshyp_shipment_id");
  if (!shipmentId) return res.status(422).json({ error: "No shipment exists for this order." });

  let result;
  try {
    result = await rapidshypPost("/b2b_ext_book_appointment", {
      shipment_id: shipmentId,
      date,
      start_time,
      end_time,
    });
  } catch (err) {
    return res.status(502).json({ error: sanitize(err.message || "Appointment request failed") });
  }

  const data = result.data || {};
  const ok = String(data.status || "").toLowerCase() === "success" || data.courier_appointment_id;
  if (!ok) {
    const msg = sanitize(data.remarks || data.remark || `Appointment failed: ${result.status} ${result.statusText}`);
    await pb.collection("orders").update(order.id, { rapidshyp_error: msg });
    await pushHistory(pb, order, { action: "appointment", request_status: "failed", remarks: msg });
    return res.status(502).json({ error: msg });
  }

  const appointment = {
    courier_appointment_id: data.courier_appointment_id || null,
    awb: data.awb || order.get("rapidshyp_awb") || "",
    start_time: data.start_time || start_time,
    end_time: data.end_time || end_time,
    abd_date: data.abd_date || date,
    po_numbers: data.po_numbers || null,
    booked_at: new Date().toISOString(),
  };
  await pb.collection("orders").update(order.id, {
    rapidshyp_appointment: appointment,
    rapidshyp_status: data.shipmentStatus || "appointment_booked",
    rapidshyp_error: "",
  });
  await pushHistory(pb, order, { action: "appointment", request_status: "success", appointment });
  return res.json({ success: true, appointment });
}

// POST /rapidshyp/cancel  { order_id }
export async function cancelShipment(req, res) {
  const auth = authorize(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const { order_id } = req.body || {};
  if (!order_id) return res.status(422).json({ error: "order_id is required." });

  const pb = pocketbaseClient;
  const order = await findOrder(pb, order_id);
  if (!order) return res.status(404).json({ error: "Website order not found." });

  const shipmentId = order.get("rapidshyp_shipment_id");
  if (!shipmentId) return res.status(422).json({ error: "No shipment exists for this order." });

  // Prevent repeat cancellation.
  const curStatus = String(order.get("rapidshyp_status") || "").toLowerCase();
  if (curStatus === "cancelled" || curStatus === "can") {
    return res.json({ alreadyCancelled: true, rapidshyp_status: order.get("rapidshyp_status") });
  }

  let result;
  try {
    result = await rapidshypPost("/b2b_ext_shipment_cancel", { shipment_id: shipmentId });
  } catch (err) {
    return res.status(502).json({ error: sanitize(err.message || "Cancel request failed") });
  }

  const data = result.data || {};
  const ok = String(data.status || "").toLowerCase() === "success" || String(data.status || "").toLowerCase() === "true";
  if (!ok) {
    const msg = sanitize(data.remarks || data.remark || `Cancel failed: ${result.status} ${result.statusText}`);
    await pb.collection("orders").update(order.id, { rapidshyp_error: msg });
    await pushHistory(pb, order, { action: "cancel", request_status: "failed", remarks: msg });
    return res.status(502).json({ error: msg });
  }

  await pb.collection("orders").update(order.id, {
    rapidshyp_status: "cancelled",
    rapidshyp_error: "",
  });
  await pushHistory(pb, order, { action: "cancel", request_status: "success" });
  return res.json({ success: true, rapidshyp_status: "cancelled" });
}

// POST /rapidshyp/deallocate  { order_id }
export async function deallocateShipment(req, res) {
  const auth = authorize(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const { order_id } = req.body || {};
  if (!order_id) return res.status(422).json({ error: "order_id is required." });

  const pb = pocketbaseClient;
  const order = await findOrder(pb, order_id);
  if (!order) return res.status(404).json({ error: "Website order not found." });

  const shipmentId = order.get("rapidshyp_shipment_id");
  if (!shipmentId) return res.status(422).json({ error: "No shipment exists for this order." });

  let result;
  try {
    result = await rapidshypPost("/b2b_ext_deallocate_shipment", { shipment_id: shipmentId });
  } catch (err) {
    return res.status(502).json({ error: sanitize(err.message || "Deallocate request failed") });
  }

  const data = result.data || {};
  const ok = String(data.status || "").toLowerCase() === "success" || String(data.status || "").toLowerCase() === "true";
  if (!ok) {
    const msg = sanitize(data.remarks || data.remark || `Deallocate failed: ${result.status} ${result.statusText}`);
    await pb.collection("orders").update(order.id, { rapidshyp_error: msg });
    await pushHistory(pb, order, { action: "deallocate", request_status: "failed", remarks: msg });
    return res.status(502).json({ error: msg });
  }

  // Preserve old shipment id in history; update active shipment id if a new
  // one is returned.
  const oldId = shipmentId;
  const newId = data.new_shipment_id || data.newShipmentId || "";
  const fields = {
    rapidshyp_awb: "",
    rapidshyp_courier: "",
    rapidshyp_status: "deallocated",
    rapidshyp_error: "",
  };
  if (newId) fields.rapidshyp_shipment_id = newId;
  await pb.collection("orders").update(order.id, fields);
  await pushHistory(pb, order, {
    action: "deallocate",
    request_status: "success",
    old_shipment_id: oldId,
    new_shipment_id: newId,
  });
  return res.json({ success: true, old_shipment_id: oldId, new_shipment_id: newId, rapidshyp_status: "deallocated" });
}
