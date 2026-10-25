import { supabase } from "@/lib/db";
import { hasReferralConsent } from "./consent";

/**
 * First-party ambassador attribution. Last touch wins: a new ?ref= link replaces the
 * previous code. Lifetime comes from pricing_settings.referral_cookie_days (90).
 *  - es_ref: the ambassador code.
 *  - es_vid: a random id used only so one visitor counts as one click per day. The
 *    database stores a salted hash of it, never the id, an IP or a user agent.
 *
 * Both cookies are optional ("referral" consent, see ./consent.ts) and are only written
 * after the visitor accepts. Until then, and after a reject:
 *  - the code is checked against published ambassadors with no visitor id, so no click
 *    row is written and nothing identifying leaves the browser;
 *  - the code is held in sessionStorage (es-ref-session) for this tab only, so a quote or
 *    order placed in the same visit is still credited to the ambassador. It is gone when
 *    the tab closes and is never written to a cookie or localStorage.
 * On accept the held code is replayed: the click is recorded and both cookies are set.
 */
const REF = "es_ref";
const VID = "es_vid";
const HELD = "es-ref-session";
const CODE_RE = /^[A-Z0-9-]{3,24}$/;

type Held = { code: string; path: string; referrer: string | null };

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const hit = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null;
}

function writeCookie(name: string, value: string, days: number) {
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${Math.round(days * 86400)}; Path=/; SameSite=Lax${secure}`;
}

function deleteCookie(name: string) {
  if (typeof document !== "undefined") document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
}

export function normaliseReferralCode(raw: string | null | undefined) {
  return String(raw ?? "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24);
}

function readHeld(): Held | null {
  try {
    const raw = sessionStorage.getItem(HELD);
    if (!raw) return null;
    const h = JSON.parse(raw) as Held;
    return h && CODE_RE.test(normaliseReferralCode(h.code)) ? h : null;
  } catch {
    return null;
  }
}

function writeHeld(h: Held | null) {
  try {
    if (h) sessionStorage.setItem(HELD, JSON.stringify(h));
    else sessionStorage.removeItem(HELD);
  } catch {
    /* storage blocked: attribution falls back to the code typed at checkout */
  }
}

/** The code in the 90-day cookie (only present after consent). */
export function getCookieReferralCode(): string | null {
  const v = normaliseReferralCode(readCookie(REF));
  return CODE_RE.test(v) ? v : null;
}

/** The ambassador code attributed to this browser or, without consent, to this visit. */
export function getReferralCode(): string | null {
  return getCookieReferralCode() ?? readHeld()?.code ?? null;
}

export function clearReferralCode() {
  deleteCookie(REF);
  writeHeld(null);
}

function visitorId() {
  let v = readCookie(VID);
  if (!v || !/^[A-Za-z0-9_-]{16,64}$/.test(v)) {
    const bytes = new Uint8Array(18);
    crypto.getRandomValues(bytes);
    v = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  return v;
}

/**
 * Handle ?ref=CODE. With consent: record a click and set both cookies. Without: validate
 * the code (no visitor id, so no click row) and hold it for this visit. Returns the
 * accepted code or null.
 */
export async function captureReferral(rawCode: string, opts?: { path?: string; referrer?: string | null }) {
  const code = normaliseReferralCode(rawCode);
  if (!CODE_RE.test(code)) return null;
  const path = opts?.path ?? location.pathname;
  const referrer = opts?.referrer !== undefined ? opts.referrer : document.referrer || null;
  const consent = hasReferralConsent();
  const vid = consent ? visitorId() : null;
  const { data, error } = await supabase.rpc("record_referral_click", {
    p_code: code,
    p_visitor: vid,
    p_path: path,
    p_referrer: referrer,
  });
  if (error) return null;
  const res = data as { ok: boolean; code?: string; cookie_days?: number };
  if (!res?.ok || !res.code) return null;
  // Consent can change while the request is in flight; honour the latest choice.
  if (consent && hasReferralConsent() && vid) {
    const days = Number(res.cookie_days) > 0 ? Number(res.cookie_days) : 90;
    writeCookie(REF, res.code, days);
    writeCookie(VID, vid, days);
    writeHeld(null);
  } else {
    writeHeld({ code: res.code, path, referrer });
  }
  return res.code;
}

/** After the visitor accepts: replay a referral held for this visit so it is recorded and kept. */
export async function persistHeldReferral() {
  const held = readHeld();
  if (!held) return getCookieReferralCode();
  return captureReferral(held.code, { path: held.path, referrer: held.referrer });
}

/**
 * After a reject or a withdrawal: remove both cookies. A code already attributed stays
 * for the rest of this visit only (sessionStorage), then is forgotten.
 */
export function dropReferralCookies() {
  const code = getCookieReferralCode();
  if (code && !readHeld()) writeHeld({ code, path: location.pathname, referrer: null });
  deleteCookie(REF);
  deleteCookie(VID);
  return code;
}
