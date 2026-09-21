import {
  EWB_THRESHOLD_INR,
  PICKUP,
  SELLER_GSTIN,
  VOLUMETRIC_DIVISOR,
} from "./config.js";

const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i;
const MOBILE = /^[6-9]\d{9}$/;
const EWB = /^\d{12}$/;
const CANCELLABLE = new Set([
  "",
  "manifested",
  "created",
  "undelivered",
  "pending_lrn",
  "pickup_scheduled",
  "in transit",
  "in-transit",
  "pending",
  "open",
  "scheduled",
]);

export function orderItems(order) {
  try {
    const items = JSON.parse(JSON.stringify(order.get("items_json") || [])) || [];
    return Array.isArray(items) ? items : [];
  } catch (_) {
    return [];
  }
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function round3(n) {
  return +Number(n).toFixed(3);
}

export function packageFromItems(items) {
  let deadKg = 0;
  let boxCount = 0;
  const groups = new Map();

  for (const it of items || []) {
    const qty = Math.max(0, Math.round(Number(it.quantity) || 0));
    if (!qty) continue;
    const w = num(it.weight_gm || it.shipping?.weight_gm);
    const length = num(it.length_cm || it.shipping?.length_cm);
    const breadth = num(it.breadth_cm || it.shipping?.breadth_cm);
    const height = num(it.height_cm || it.shipping?.height_cm);
    deadKg += (w / 1000) * qty;
    boxCount += qty;
    if (length && breadth && height) {
      const key = `${length}x${breadth}x${height}`;
      const prev = groups.get(key);
      if (prev) prev.box_count += qty;
      else groups.set(key, { length_cm: length, width_cm: breadth, height_cm: height, box_count: qty });
    }
  }

  const dimensions = [...groups.values()];
  const volKg = dimensions.reduce(
    (sum, d) => sum + (d.length_cm * d.width_cm * d.height_cm * d.box_count) / VOLUMETRIC_DIVISOR,
    0,
  );
  const primary = dimensions[0] || { length_cm: 0, width_cm: 0, height_cm: 0 };

  return {
    weight_kg: round3(deadKg),
    chargeable_kg: round3(Math.max(deadKg, volKg) || deadKg),
    length_cm: primary.length_cm,
    breadth_cm: primary.width_cm,
    height_cm: primary.height_cm,
    box_count: Math.max(1, boxCount),
    dimensions,
  };
}

function firstValue(obj, keys) {
  if (!obj || typeof obj !== "object") return "";
  for (const k of keys) {
    const v = obj[k];
    if (v != null && String(v).trim() !== "") return v;
  }
  return "";
}

function flatten(data) {
  if (!data || typeof data !== "object") return {};
  const root = data.data && typeof data.data === "object" ? { ...data, ...data.data } : { ...data };
  const nested = root.job || root.shipment || root.result || root.payload || {};
  const list = Array.isArray(root.packages)
    ? root.packages[0]
    : Array.isArray(root.shipments)
      ? root.shipments[0]
      : nested;
  return { ...root, ...(list && typeof list === "object" ? list : {}) };
}

export function extractShipmentIds(data) {
  const src = flatten(data);
  const awbRaw = firstValue(src, ["master_waybill", "master_awb", "waybill", "awb", "wbns"]);
  return {
    job_id: String(firstValue(src, ["job_id", "jobId", "pickup_id", "pickupId", "request_id"]) || ""),
    lrn: String(firstValue(src, ["lrn", "lrnum", "lr_number", "lrNumber"]) || ""),
    awb: String(Array.isArray(awbRaw) ? awbRaw[0] : awbRaw || ""),
    status: String(firstValue(src, ["status", "shipment_status", "job_status"]) || ""),
    label: String(firstValue(src, ["label_url", "packing_slip", "pdf_url", "url", "label"]) || ""),
  };
}

export function extractQuote(data) {
  const root = flatten(data);
  const quotes = Array.isArray(root.quotes) ? root.quotes[0] : root;
  const src = quotes && typeof quotes === "object" ? quotes : root;
  const listed = Number(
    firstValue(src, [
      "total_amount",
      "totalAmount",
      "total_freight",
      "estimated_freight",
      "estimated_amount",
      "grand_total",
    ]),
  );
  const summed =
    Number(src.freight_charge || src.freight_charges || src.basic_freight || 0) +
    Number(src.fuel_surcharge || src.fsc || 0) +
    Number(src.gst || src.tax || src.tax_amount || 0);
  const total = listed || summed;
  return {
    total: Number.isFinite(total) ? total : 0,
    charged_weight: Number(src.charged_weight || src.chargeable_weight || src.weight || 0) || null,
    edd: firstValue(src, ["edd", "estimated_delivery", "tat", "delivery_days"]) || null,
    mode: src.mode || src.shipping_mode || "Surface",
  };
}

export function extractTrack(data) {
  const src = flatten(data);
  const statusObj = src.Status && typeof src.Status === "object" ? src.Status : src;
  return {
    status: String(firstValue(statusObj, ["Status", "status", "shipment_status", "Instructions"]) || ""),
    location: String(firstValue(statusObj, ["StatusLocation", "location", "city"]) || ""),
    scanned_at: firstValue(statusObj, ["StatusDateTime", "scan_datetime", "timestamp"]) || "",
    lrn: String(firstValue(src, ["lrn", "LRN", "lrnum"]) || ""),
  };
}

export function extractUrl(data, extraKeys = []) {
  const src = flatten(data);
  const list = src.urls || src.links || (Array.isArray(src.data) ? src.data : null);
  if (Array.isArray(list) && list[0]) {
    const first = list[0];
    return String(typeof first === "string" ? first : first.url || first.label_url || "");
  }
  return String(firstValue(src, ["label_url", "pdf_url", "url", "pod_url", "pod", "image_url", ...extraKeys]) || "");
}

export function invoiceValueInr(order) {
  return +((Number(order.get("amount_in_paise") || 0)) / 100).toFixed(2);
}

export function ewayBillOf(order) {
  return String(order.get("eway_bill") || order.get("ewb") || "").replace(/\D/g, "");
}

export function hasBookedLr(order) {
  return Boolean(String(order.get("delhivery_lrn") || "").trim());
}

export function isCancellable(status) {
  return CANCELLABLE.has(String(status || "").toLowerCase());
}

export function validatePickupLocation() {
  const errors = [];
  if (!PICKUP.name) errors.push("DELHIVERY_PICKUP_NAME is required.");
  if (!/^\d{6}$/.test(PICKUP.pin_code)) errors.push("DELHIVERY_PICKUP_PINCODE must be a valid 6-digit pincode.");
  if (!PICKUP.city) errors.push("DELHIVERY_PICKUP_CITY is required.");
  if (!PICKUP.state) errors.push("DELHIVERY_PICKUP_STATE is required.");
  if (!PICKUP.address || PICKUP.address.length < 10) {
    errors.push("DELHIVERY_PICKUP_ADDRESS must be a complete street address.");
  }
  if (!MOBILE.test(PICKUP.phone)) errors.push("DELHIVERY_PICKUP_PHONE must be a valid 10-digit mobile.");
  return errors;
}

export function validateOrderForShipment(order) {
  const errors = [];
  const name = (order.get("customer_name") || "").trim();
  if (name.length < 3) errors.push("Customer name is required (min 3 chars).");

  const phone = (order.get("customer_phone") || "").replace(/\D/g, "").slice(-10);
  if (!MOBILE.test(phone)) errors.push("A valid 10-digit mobile (starting 6-9) is required.");

  const address = (order.get("shipping_address") || "").trim();
  if (address.length < 3) errors.push("Shipping address is required.");

  const city = (order.get("shipping_city") || "").trim();
  if (!city) errors.push("Shipping city is required.");

  const state = (order.get("shipping_state") || "").trim();
  if (!state) errors.push("Shipping state is required.");

  const pincode = (order.get("shipping_pincode") || "").replace(/\D/g, "");
  if (!/^\d{6}$/.test(pincode)) errors.push("A valid 6-digit pincode is required.");

  const amount = invoiceValueInr(order);
  if (!(amount > 0)) errors.push("Invoice value must be positive.");

  const items = orderItems(order);
  if (!items.length) errors.push("Order has no item lines.");
  else {
    items.forEach((it, i) => {
      if (!(num(it.quantity) > 0)) errors.push(`Item ${i + 1}: quantity must be positive.`);
      if (!(num(it.weight_gm || it.shipping?.weight_gm) > 0)) {
        errors.push(`Item ${i + 1}: weight (gm) is required.`);
      }
      if (
        !(num(it.length_cm || it.shipping?.length_cm) > 0) ||
        !(num(it.breadth_cm || it.shipping?.breadth_cm) > 0) ||
        !(num(it.height_cm || it.shipping?.height_cm) > 0)
      ) {
        errors.push(`Item ${i + 1}: dimensions (cm) are required.`);
      }
    });
  }

  const pkg = packageFromItems(items);
  if (!(pkg.weight_kg > 0)) errors.push("Shipment weight must be positive.");
  if (!pkg.dimensions.length) {
    errors.push("Package length, breadth and height (cm) are required.");
  }

  if (SELLER_GSTIN && !GSTIN.test(SELLER_GSTIN)) {
    errors.push("DELHIVERY_SELLER_GSTIN must be a valid GSTIN when set.");
  }
  const consigneeGst = (order.get("gst_number") || "").trim();
  if (consigneeGst && !GSTIN.test(consigneeGst)) errors.push("Consignee GSTIN is invalid.");

  if (amount > EWB_THRESHOLD_INR && !EWB.test(ewayBillOf(order))) {
    errors.push(`E-way bill (12 digits) is required for invoices above ₹${EWB_THRESHOLD_INR.toLocaleString("en-IN")}.`);
  }

  errors.push(...validatePickupLocation());
  return { ok: errors.length === 0, errors, pkg, amount };
}

export function normalizeBoxDimensions(input, fallbackBoxCount = 1) {
  const fallback = Math.max(1, Math.round(Number(fallbackBoxCount)) || 1);
  const list = Array.isArray(input) ? input : input ? [input] : [];
  const out = [];
  for (const d of list) {
    if (!d || typeof d !== "object") continue;
    const length = Number(d.length_cm ?? d.length) || 0;
    const width = Number(d.width_cm ?? d.width ?? d.breadth_cm ?? d.breadth) || 0;
    const height = Number(d.height_cm ?? d.height) || 0;
    if (!(length && width && height)) continue;
    const raw = Number(d.box_count ?? d.count);
    const count =
      Number.isFinite(raw) && raw > 0
        ? Math.max(1, Math.round(raw))
        : list.length === 1
          ? fallback
          : 1;
    out.push({ length_cm: length, width_cm: width, height_cm: height, box_count: count });
  }
  return out;
}

export function buildQuotePayload({ pin, weightKg, invoiceValue, dimensions, boxCount }) {
  const payload = {
    weight_g: Math.round(Number(weightKg) * 1000),
    cheque_payment: false,
    source_pin: Number(PICKUP.pin_code) || PICKUP.pin_code,
    consignee_pin: Number(pin) || pin,
    payment_mode: "prepaid",
    inv_amount: invoiceValue || 0,
    freight_mode: "fop",
    rov_insurance: false,
  };
  const boxes = normalizeBoxDimensions(dimensions, boxCount);
  if (boxes.length) payload.dimensions = boxes;
  return payload;
}

export function buildManifestPayload(order, pkg) {
  const items = orderItems(order);
  const ident = String(order.get("order_number") || order.id);
  const invoiceValue = invoiceValueInr(order);
  const ewb = ewayBillOf(order);
  const description =
    items
      .map((it) => it.title || it.product_title || "Product")
      .filter(Boolean)
      .slice(0, 3)
      .join(", ")
      .slice(0, 200) || "Handicraft goods";
  const weightGm = Math.round(pkg.weight_kg * 1000);

  return {
    pickup_location_name: PICKUP.name,
    payment_mode: "prepaid",
    weight: weightGm,
    dropoff_location: {
      consignee_name: (order.get("customer_name") || "").trim(),
      phone: (order.get("customer_phone") || "").replace(/\D/g, "").slice(-10),
      address: (order.get("shipping_address") || "").trim(),
      city: (order.get("shipping_city") || "").trim(),
      state: (order.get("shipping_state") || "").trim(),
      zip: (order.get("shipping_pincode") || "").replace(/\D/g, ""),
      email: order.get("customer_email") || "",
    },
    invoices: [
      {
        ewaybill: ewb || "",
        inv_num: ident,
        inv_amt: invoiceValue,
        inv_qr_code: "",
      },
    ],
    shipment_details: [
      {
        order_id: ident,
        box_count: pkg.box_count,
        description,
        weight: weightGm,
        waybills: [],
        master: false,
      },
    ],
    dimensions: pkg.dimensions?.length
      ? pkg.dimensions
      : [
          {
            length_cm: pkg.length_cm,
            width_cm: pkg.breadth_cm,
            height_cm: pkg.height_cm,
            box_count: pkg.box_count || 1,
          },
        ],
    rov_insurance: false,
    fm_pickup: false,
  };
}

export function buildPickupPayload(_order, { date, slot, boxCount }) {
  return {
    client_warehouse: PICKUP.name,
    pickup_date: date,
    start_time: slot,
    expected_package_count: boxCount,
  };
}

/** Same-day B2B pickup must be raised before 14:00 IST. */
export function assertPickupSchedule(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return "date must be YYYY-MM-DD.";
  const [y, m, d] = date.split("-").map(Number);
  const istNow = new Date(Date.now() + 330 * 60 * 1000);
  const today = `${istNow.getUTCFullYear()}-${String(istNow.getUTCMonth() + 1).padStart(2, "0")}-${String(istNow.getUTCDate()).padStart(2, "0")}`;
  const chosen = new Date(Date.UTC(y, m - 1, d));
  const startToday = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate()));
  if (chosen < startToday) return "Pickup date cannot be in the past.";
  if (date === today && istNow.getUTCHours() >= 14) {
    return "Same-day pickup must be requested before 2:00 PM IST.";
  }
  return "";
}
