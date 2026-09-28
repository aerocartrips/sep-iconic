import { TIMEOUT_MS } from "./config.js";
import { buildManifestForm } from "./shipment.js";
import { delhiveryRequest, isApiSuccess } from "./http.js";

const serviceabilityCache = new Map();
const SERVICEABILITY_TTL_MS = 15 * 60 * 1000;
const SERVICEABILITY_MAX = 400;

function cacheGet(key) {
  const hit = serviceabilityCache.get(key);

  if (!hit || hit.exp < Date.now()) {
    if (hit) serviceabilityCache.delete(key);
    return null;
  }

  return hit.value;
}

function cacheSet(key, value) {
  if (serviceabilityCache.size >= SERVICEABILITY_MAX) {
    serviceabilityCache.delete(serviceabilityCache.keys().next().value);
  }

  serviceabilityCache.set(key, {
    value,
    exp: Date.now() + SERVICEABILITY_TTL_MS,
  });
}

function firstRow(data) {
  const root =
    data?.data && typeof data.data === "object"
      ? data.data
      : data;

  const list =
    root?.pincode_serviceability_data ||
    root?.pincode_data ||
    root?.result;

  if (Array.isArray(list) && list[0]) {
    return list[0];
  }

  return root || {};
}

function isYes(value) {
  return (
    value === true ||
    value === "Y" ||
    value === "y" ||
    String(value).toLowerCase() === "true"
  );
}

function isNo(value) {
  return value === false || value === "N" || value === "n";
}

export function parseServiceability(data, pincode) {
  const row = firstRow(data);

  const flag =
    row.lm_serviceable ??
    row.serviceable ??
    row.prepaid ??
    row.fm_serviceable ??
    data?.success;

  const serviceable =
    isYes(flag) ||
    (data?.success === true && !isNo(flag));

  return {
    serviceable: Boolean(serviceable),
    pincode: String(row.pincode || pincode),
    city: row.city || "",
    state: row.state || "",
    oda: Boolean(row.oda),
  };
}

/**
 * Convert nested manifest fields to multipart form fields.
 *
 * IMPORTANT:
 * Delhivery /manifest expects the nested values to be supplied
 * as JSON values inside multipart/form-data.
 *
 * Do NOT wrap JSON values in Blob(application/json).
 * Blob can make the multipart part behave like a file/upload
 * instead of the expected form value.
 */
function toForm(fields) {
  const form = new FormData();

  for (const [key, value] of Object.entries(fields || {})) {
    if (value == null || value === "") {
      continue;
    }

    if (typeof value === "object") {
      form.append(key, JSON.stringify(value));
    } else {
      form.append(key, String(value));
    }
  }

  return form;
}

/** GET /pincode-service/{pincode}?weight= */
export async function checkServiceability(
  pincode,
  weightKg = 1,
) {
  const pin = String(pincode || "")
    .replace(/\D/g, "")
    .slice(0, 6);

  const weight =
    Number(weightKg) > 0
      ? Number(weightKg)
      : 1;

  const key = `${pin}:${weight.toFixed(2)}`;

  const cached = cacheGet(key);

  if (cached) {
    return {
      ...cached,
      cached: true,
    };
  }

  const result = await delhiveryRequest(
    "GET",
    `/pincode-service/${pin}`,
    {
      query: { weight },
      timeout: TIMEOUT_MS.serviceability,
    },
  );

  const parsed = parseServiceability(
    result.data,
    pin,
  );

  parsed.ok =
    isApiSuccess(result) ||
    parsed.serviceable;

  if (parsed.ok) {
    cacheSet(key, parsed);
  }

  return parsed;
}

/** POST /freight/estimate */
export function getFreightQuote(payload) {
  return delhiveryRequest(
    "POST",
    "/freight/estimate",
    {
      json: payload,
      timeout: TIMEOUT_MS.quote,
    },
  );
}

/** POST /client-warehouse/create/ */
export function createWarehouse(payload) {
  return delhiveryRequest(
    "POST",
    "/client-warehouse/create/",
    {
      json: payload,
      timeout: TIMEOUT_MS.manifest,
    },
  );
}

/**
 * POST /manifest
 *
 * Delhivery B2B manifest is multipart/form-data.
 */
export function manifestShipment(payload) {
  return delhiveryRequest(
    "POST",
    "/manifest",
    {
      form: buildManifestForm(payload),
      timeout: TIMEOUT_MS.manifest,
    },
  );
}

/** GET /manifest?job_id= */
export function fetchManifestJob(jobId) {
  return delhiveryRequest(
    "GET",
    "/manifest",
    {
      query: { job_id: jobId },
      timeout: TIMEOUT_MS.manifest,
    },
  );
}

/** GET /label/get_urls/<size>/<lrn> */
export function fetchPackingSlip(lrn) {
  return delhiveryRequest(
    "GET",
    `/label/get_urls/std/${encodeURIComponent(lrn)}`,
  );
}

/** POST /pickup_requests/ */
export function requestPickup(payload) {
  return delhiveryRequest(
    "POST",
    "/pickup_requests/",
    {
      json: payload,
    },
  );
}

/** DELETE /lrn/cancel/<lrn> */
export function cancelLrn(lrn) {
  return delhiveryRequest(
    "DELETE",
    `/lrn/cancel/${encodeURIComponent(lrn)}`,
  );
}

/** GET /lrn/track?lrnum= */
export function trackShipment(lrn) {
  return delhiveryRequest(
    "GET",
    "/lrn/track",
    {
      query: { lrnum: lrn },
    },
  );
}

/** GET /document/download?lrn=&doc_type=LM_POD */
export function fetchPod(lrn) {
  return delhiveryRequest(
    "GET",
    "/document/download",
    {
      query: {
        lrn,
        doc_type: "LM_POD",
        version: "latest",
      },
    },
  );
}