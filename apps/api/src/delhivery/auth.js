import PocketBase from "pocketbase";
import { POCKETBASE_HOST } from "../utils/pocketbaseClient.js";
import { ADMIN_EMAILS } from "./config.js";

function tokenFrom(req) {
  return String(req.headers["x-pb-token"] || req.headers.authorization || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

export async function verifySession(req) {
  const token = tokenFrom(req);
  if (!token) return null;

  const pb = new PocketBase(POCKETBASE_HOST);
  pb.autoCancellation(false);
  pb.authStore.save(token, null);

  for (const col of ["users", "_superusers"]) {
    try {
      const { record } = await pb.collection(col).authRefresh();
      return {
        id: record.id,
        email: String(record.email || "").toLowerCase(),
        superuser: col === "_superusers",
      };
    } catch (_) {}
  }
  return null;
}

export function isAdmin(session) {
  if (!session) return false;
  if (session.superuser) return true;
  return ADMIN_EMAILS.includes(session.email);
}

export async function requireAdmin(req) {
  const session = await verifySession(req);
  if (!session) return { ok: false, status: 401, error: "Authentication required." };
  if (!isAdmin(session)) return { ok: false, status: 403, error: "Not authorized for shipping actions." };
  return { ok: true, session };
}

export async function requireOrderAccess(req, order) {
  const session = await verifySession(req);
  if (!session) return { ok: false, status: 401, error: "Authentication required." };
  if (isAdmin(session)) return { ok: true, session };
  const owner = String(order.get("owner") || "");
  const email = String(order.get("customer_email") || "").toLowerCase();
  if ((owner && owner === session.id) || (email && email === session.email)) {
    return { ok: true, session };
  }
  return { ok: false, status: 403, error: "Not authorized to access this shipment." };
}
