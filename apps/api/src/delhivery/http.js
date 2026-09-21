import {
  isConfigured,
  PASSWORD,
  SERVICEABILITY_BASE,
  TIMEOUT_MS,
  USERNAME,
} from "./config.js";

export class DelhiveryError extends Error {
  constructor(message, { status = 502, notConfigured = false } = {}) {
    super(message);
    this.name = "DelhiveryError";
    this.status = status;
    this.notConfigured = notConfigured;
  }
}

const jwtState = { token: "", exp: 0, inflight: null };

export function sanitize(text) {
  if (!text) return "";
  let out = String(text);
  if (PASSWORD) out = out.split(PASSWORD).join("[redacted]");
  return out
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, "Bearer [redacted]")
    .replace(/Token\s+[A-Za-z0-9._\-]+/gi, "Token [redacted]")
    .replace(/eyJ[A-Za-z0-9_\-]+=*\.[A-Za-z0-9_\-]+=*\.[A-Za-z0-9_\-]+=*/g, "[redacted]");
}

function jwtExpMs(jwt) {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8"));
    if (payload.exp) return payload.exp * 1000;
  } catch (_) {}
  return Date.now() + 50 * 60 * 1000;
}

async function login() {
  const res = await fetch(`${SERVICEABILITY_BASE}/ums/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
    signal: AbortSignal.timeout(TIMEOUT_MS.default),
  });
  const data = await readBody(res);
  const jwt =
    data?.jwt || data?.token || data?.data?.jwt || data?.data?.token || data?.access_token || "";
  if (!res.ok || !jwt) {
    throw new DelhiveryError(sanitize(pickMessage(data) || "Delhivery login failed"), {
      status: res.status || 502,
      notConfigured: res.status === 401,
    });
  }
  jwtState.token = jwt;
  jwtState.exp = jwtExpMs(jwt);
  return jwt;
}

async function getJwt(force = false) {
  if (!USERNAME || !PASSWORD) return "";
  if (!force && jwtState.token && Date.now() < jwtState.exp - 60_000) return jwtState.token;
  if (force) jwtState.inflight = null;
  if (!jwtState.inflight) {
    jwtState.token = "";
    jwtState.exp = 0;
    jwtState.inflight = login().finally(() => {
      jwtState.inflight = null;
    });
  }
  return jwtState.inflight;
}

async function authHeaders({ multipart = false } = {}) {
  const headers = { Accept: "application/json" };
  if (!multipart) headers["Content-Type"] = "application/json";
  const jwt = await getJwt();
  if (jwt) headers.Authorization = `Bearer ${jwt}`;
  return headers;
}

async function readBody(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_) {
    return { raw: text.slice(0, 2000) };
  }
}

export function pickMessage(data) {
  if (!data || typeof data !== "object") return "";
  const nested = data.errors || data.error;
  const nestedMsg =
    nested && typeof nested === "object"
      ? Object.values(nested).flat?.().filter(Boolean)[0] || nested.message || ""
      : "";
  return String(
    data.message ||
      (typeof data.error === "string" ? data.error : "") ||
      data.remarks ||
      data.remark ||
      data.detail ||
      nestedMsg ||
      (typeof data.raw === "string" ? data.raw.slice(0, 240) : "") ||
      "",
  );
}

export function isApiSuccess(result) {
  if (!result) return false;
  if (result.ok) return true;
  const flag = result.data?.success ?? result.data?.status ?? result.data?.ok;
  if (flag === true) return true;
  const s = String(flag || "").toLowerCase();
  return s === "success" || s === "true" || s === "ok";
}

export async function delhiveryRequest(method, path, { json, form, query, timeout } = {}) {
  if (!isConfigured()) {
    throw new DelhiveryError(
      "Delhivery is not configured. Set DELHIVERY_USERNAME and DELHIVERY_PASSWORD.",
      { status: 503, notConfigured: true },
    );
  }

  const url = new URL(path.startsWith("http") ? path : `${SERVICEABILITY_BASE}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v != null && v !== "") url.searchParams.set(k, String(v));
    }
  }

  const send = async (headers) => {
    const init = { method, headers, signal: AbortSignal.timeout(timeout || TIMEOUT_MS.default) };
    if (form) init.body = form;
    else if (json !== undefined) init.body = JSON.stringify(json);
    try {
      return await fetch(url, init);
    } catch (err) {
      if (err?.name === "TimeoutError" || err?.name === "AbortError") {
        throw new DelhiveryError("Delhivery request timed out", { status: 504 });
      }
      throw new DelhiveryError(sanitize(err.message || "Delhivery network error"), { status: 502 });
    }
  };

  let headers = await authHeaders({ multipart: Boolean(form) });
  let res = await send(headers);

  if (res.status === 401 && USERNAME && PASSWORD) {
    headers.Authorization = `Bearer ${await getJwt(true)}`;
    res = await send(headers);
  }

  const data = await readBody(res);
  return {
    ok: res.ok,
    status: res.status,
    statusText: res.statusText,
    data,
    url: url.origin + url.pathname,
  };
}
