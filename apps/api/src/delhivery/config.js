/**
 * Delhivery B2B (LTL) hosts from the developer portal.
 * https://one.delhivery.com/developer-portal/documents/b2b/
 *
 * All B2B APIs use this host + UMS Bearer JWT. Do not call Express (track.delhivery.com)
 * or btob.api.delhivery.com for these operations.
 */
function trimUrl(value, fallback) {
  return String(value || fallback || "").trim().replace(/\/+$/, "");
}

/** Delhivery B2B pin fields are strings (Pydantic: str type expected). */
export function pinCode(value, max = 6) {
  return String(value || "")
    .replace(/\D/g, "")
    .slice(0, max);
}

const PRESETS = {
  production: "https://ltl-clients-api.delhivery.com",
  staging: "https://ltl-clients-api-dev.delhivery.com",
};

export const DELHIVERY_ENV = ["staging", "test", "dev"].includes(
  String(process.env.DELHIVERY_ENV || "production").toLowerCase(),
)
  ? "staging"
  : "production";

export const USERNAME = (process.env.DELHIVERY_USERNAME || "").trim();
export const PASSWORD = (process.env.DELHIVERY_PASSWORD || "").trim();

export const SERVICEABILITY_BASE = trimUrl(
  process.env.DELHIVERY_SERVICEABILITY_URL || process.env.DELHIVERY_BASE_URL,
  PRESETS[DELHIVERY_ENV],
);
export const BOOKING_BASE = SERVICEABILITY_BASE;

export const HOSTS = {
  serviceability: SERVICEABILITY_BASE,
  booking: SERVICEABILITY_BASE,
};

const PICKUP_NAME = (process.env.DELHIVERY_PICKUP_NAME || "").trim();

export const PICKUP = {
  name: PICKUP_NAME,
  contact: (process.env.DELHIVERY_PICKUP_CONTACT || PICKUP_NAME).trim(),
  pin_code: pinCode(process.env.DELHIVERY_PICKUP_PINCODE),
  city: (process.env.DELHIVERY_PICKUP_CITY || "").trim(),
  state: (process.env.DELHIVERY_PICKUP_STATE || "").trim(),
  country: (process.env.DELHIVERY_PICKUP_COUNTRY || "India").trim(),
  address: (process.env.DELHIVERY_PICKUP_ADDRESS || "").trim(),
  phone: pinCode(process.env.DELHIVERY_PICKUP_PHONE, 10).slice(-10),
  email: (process.env.DELHIVERY_PICKUP_EMAIL || "").trim(),
};

/** POST /client-warehouse/create/ */
export function warehouseCreatePayload() {
  return {
    name: PICKUP.name,
    pin_code: PICKUP.pin_code,
    city: PICKUP.city,
    state: PICKUP.state,
    country: PICKUP.country,
    address_details: {
      address: PICKUP.address,
      contact_person: PICKUP.contact,
      phone_number: PICKUP.phone,
    },
    same_as_fwd_add: true,
  };
}

export const SELLER_GSTIN = (process.env.DELHIVERY_SELLER_GSTIN || "").trim().toUpperCase();
export const DEFAULT_HSN = (process.env.DELHIVERY_DEFAULT_HSN || "").trim();
export const EWB_THRESHOLD_INR = 50_000;
export const VOLUMETRIC_DIVISOR = 5_000;

export const ADMIN_EMAILS = (process.env.DELHIVERY_ADMIN_EMAILS || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export const TIMEOUT_MS = {
  default: 12_000,
  quote: 8_000,
  serviceability: 6_000,
  manifest: 20_000,
};

export function canQuote() {
  return Boolean(USERNAME && PASSWORD);
}

export function canBook() {
  return Boolean(USERNAME && PASSWORD);
}

export function isConfigured() {
  return canQuote();
}
