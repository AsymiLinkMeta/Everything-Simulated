export const DEFAULT_TOLERANCE_SECONDS = 300;

export type SignatureResult = { ok: true; timestamp: number } | { ok: false; reason: string };

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

/** Parse "t=123,v1=abc,v1=def,v0=..." into a timestamp and every v1 signature. */
export function parseSignatureHeader(header: string): { t: number | null; v1: string[] } {
  let t: number | null = null;
  const v1: string[] = [];
  for (const part of header.split(",")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k === "t" && /^\d+$/.test(v)) t = Number(v);
    if (k === "v1" && v) v1.push(v);
  }
  return { t, v1 };
}

/**
 * Verify a Stripe-Signature header the way Stripe's SDK does: HMAC-SHA256 of
 * "{t}.{rawBody}" with the endpoint secret, any matching v1, and a timestamp
 * within the tolerance window. Fails closed when the secret is missing.
 */
export async function verifyStripeSignature(input: {
  payload: string;
  header: string | null;
  secret: string | undefined | null;
  toleranceSeconds?: number;
  nowSeconds?: number;
}): Promise<SignatureResult> {
  if (!input.secret) return { ok: false, reason: "webhook secret not configured" };
  if (!input.header) return { ok: false, reason: "missing signature header" };
  const { t, v1 } = parseSignatureHeader(input.header);
  if (t === null) return { ok: false, reason: "missing timestamp" };
  if (v1.length === 0) return { ok: false, reason: "missing v1 signature" };
  const tolerance = input.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - t) > tolerance) return { ok: false, reason: "timestamp outside tolerance" };
  const expected = await hmacSha256Hex(input.secret, `${t}.${input.payload}`);
  if (!v1.some((sig) => timingSafeEqual(expected, sig))) return { ok: false, reason: "signature mismatch" };
  return { ok: true, timestamp: t };
}

/** Test helper / local tooling: produce a valid header for a payload. */
export async function signStripePayload(payload: string, secret: string, timestamp: number): Promise<string> {
  return `t=${timestamp},v1=${await hmacSha256Hex(secret, `${timestamp}.${payload}`)}`;
}
