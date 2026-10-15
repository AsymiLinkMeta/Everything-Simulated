export type MailKind = "placed" | "paid" | "tracking" | "refund" | "ticket";
export const MAIL_KINDS: MailKind[] = ["placed", "paid", "tracking", "refund", "ticket"];

export type MailCaller =
  | { kind: "internal" }
  | { kind: "user"; userId: string; email: string | null; isStaff: boolean }
  | { kind: "anonymous" };

export type MailOrder = { id: string; userId: string | null; contactEmail: string | null } | null;

export type MailDecision = { ok: true; to: string } | { ok: false; status: number; error: string };

const norm = (v: string | null | undefined) => String(v ?? "").trim().toLowerCase();
const isEmail = (v: string) => /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/.test(v);

/**
 * Decide whether a caller may send this mail and to whom.
 * - internal (shared secret, e.g. the Stripe webhook) and staff: any kind; the
 *   recipient defaults to the order's customer, and may be overridden.
 * - signed-in customers: only "placed", only for an order they own, and only to
 *   the order's own email or their account email. They cannot choose a stranger.
 * - anonymous: never.
 */
export function authorizeMail(input: {
  caller: MailCaller;
  kind: MailKind;
  order: MailOrder;
  requestedTo?: string | null;
}): MailDecision {
  const { caller, kind, order } = input;
  const requested = norm(input.requestedTo);
  if (!MAIL_KINDS.includes(kind)) return { ok: false, status: 400, error: "Unknown mail kind" };
  if (caller.kind === "anonymous") return { ok: false, status: 401, error: "Sign in required" };
  if (kind !== "ticket" && !order) return { ok: false, status: 404, error: "Order not found" };

  const orderEmail = norm(order?.contactEmail);

  if (caller.kind === "internal" || caller.isStaff) {
    const to = requested || orderEmail;
    if (!isEmail(to)) return { ok: false, status: 400, error: "No customer email" };
    return { ok: true, to };
  }

  // Signed-in customer.
  if (kind !== "placed") return { ok: false, status: 403, error: "Not allowed" };
  if (!order || !order.userId || order.userId !== caller.userId) {
    return { ok: false, status: 403, error: "Not your order" };
  }
  const own = new Set([orderEmail, norm(caller.email)].filter(Boolean));
  const to = requested || orderEmail || norm(caller.email);
  if (!own.has(to) || !isEmail(to)) return { ok: false, status: 403, error: "Recipient not allowed" };
  return { ok: true, to };
}
