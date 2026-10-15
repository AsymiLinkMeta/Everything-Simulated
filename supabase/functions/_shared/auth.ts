import { timingSafeEqual } from "./stripe-signature.ts";

/** True when the request carries the shared internal secret (function-to-function calls). */
export function hasInternalSecret(req: Request, secret: string): boolean {
  if (!secret) return false;
  const given = req.headers.get("X-Internal-Secret") ?? "";
  return given.length > 0 && timingSafeEqual(given, secret);
}

export const STAFF_ROLES = ["sales", "workshop", "content", "support", "admin"] as const;
export const isStaffRole = (role: unknown) => STAFF_ROLES.includes(String(role) as (typeof STAFF_ROLES)[number]);
