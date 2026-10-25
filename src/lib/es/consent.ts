/**
 * Cookie consent: one first-party record in localStorage, versioned and timestamped.
 *
 *   es-consent = { "v": 1, "referral": true|false, "ts": "2026-10-25T01:23:45.000Z" }
 *
 * The only optional category is "referral" (the es_ref / es_vid ambassador cookies).
 * Everything else the site stores is strictly necessary (this record, the cart, the
 * signed-in session) and is listed in the privacy policy. Bump CONSENT_VERSION when
 * a new optional category is added so visitors are asked again.
 */
export const CONSENT_KEY = "es-consent";
export const CONSENT_VERSION = 1;
const LEGACY_KEY = "es-cookie-ack";
const EVENT = "es:consent";
const OPEN_EVENT = "es:consent-open";

export type ConsentRecord = { v: number; referral: boolean; ts: string };

function isRecord(x: unknown): x is ConsentRecord {
  const r = x as ConsentRecord;
  return !!r && typeof r === "object" && r.v === CONSENT_VERSION && typeof r.referral === "boolean" && typeof r.ts === "string";
}

/** The visitor's current choice, or null if they haven't made one (or it is from an older version). */
export function readConsent(): ConsentRecord | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function hasReferralConsent() {
  return readConsent()?.referral === true;
}

export function writeConsent(referral: boolean): ConsentRecord {
  const rec: ConsentRecord = { v: CONSENT_VERSION, referral, ts: new Date().toISOString() };
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(rec));
    // The old notice only stored an acknowledgement; it is superseded by this record.
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* private mode or storage full: the choice still applies for this page view */
  }
  window.dispatchEvent(new CustomEvent<ConsentRecord>(EVENT, { detail: rec }));
  return rec;
}

export function onConsentChange(fn: (rec: ConsentRecord) => void) {
  const handler = (e: Event) => fn((e as CustomEvent<ConsentRecord>).detail);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

/** Reopen the cookie settings (footer "Cookie settings" link, privacy policy). */
export function openConsentSettings() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function onConsentOpen(fn: () => void) {
  window.addEventListener(OPEN_EVENT, fn);
  return () => window.removeEventListener(OPEN_EVENT, fn);
}
