import { supabase } from "@/lib/db";

/**
 * First-party ambassador attribution. Last touch wins: a new ?ref= link replaces the
 * previous code. Lifetime comes from pricing_settings.referral_cookie_days (90).
 *  - es_ref: the ambassador code.
 *  - es_vid: a random id used only so one visitor counts as one click per day. The
 *    database stores a salted hash of it, never the id, an IP or a user agent.
 */
const REF = "es_ref";
const VID = "es_vid";
const CODE_RE = /^[A-Z0-9-]{3,24}$/;

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const hit = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null;
}

function writeCookie(name: string, value: string, days: number) {
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${Math.round(days * 86400)}; Path=/; SameSite=Lax${secure}`;
}

export function normaliseReferralCode(raw: string | null | undefined) {
  return String(raw ?? "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24);
}

/** The ambassador code currently attributed to this browser, if any. */
export function getReferralCode(): string | null {
  const v = normaliseReferralCode(readCookie(REF));
  return CODE_RE.test(v) ? v : null;
}

export function clearReferralCode() {
  if (typeof document !== "undefined") document.cookie = `${REF}=; Max-Age=0; Path=/; SameSite=Lax`;
}

function visitorId(days: number) {
  let v = readCookie(VID);
  if (!v || !/^[A-Za-z0-9_-]{16,64}$/.test(v)) {
    const bytes = new Uint8Array(18);
    crypto.getRandomValues(bytes);
    v = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  writeCookie(VID, v, days);
  return v;
}

/**
 * Record a click for ?ref=CODE and, if the code belongs to a published ambassador,
 * set the attribution cookie. Returns the accepted code or null.
 */
export async function captureReferral(rawCode: string, opts?: { path?: string; referrer?: string }) {
  const code = normaliseReferralCode(rawCode);
  if (!CODE_RE.test(code)) return null;
  const vid = visitorId(90);
  const { data, error } = await supabase.rpc("record_referral_click", {
    p_code: code,
    p_visitor: vid,
    p_path: opts?.path ?? location.pathname,
    p_referrer: opts?.referrer ?? (document.referrer || null),
  });
  if (error) return null;
  const res = data as { ok: boolean; code?: string; cookie_days?: number };
  if (!res?.ok || !res.code) return null;
  const days = Number(res.cookie_days) > 0 ? Number(res.cookie_days) : 90;
  writeCookie(REF, res.code, days);
  writeCookie(VID, vid, days);
  return res.code;
}
