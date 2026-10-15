import { supabase } from "@/lib/db";

/** Trust-bar facts. Every key is optional: unset means "don't claim it". */
export const TRUST_KEYS = [
  "trust_lead_time",
  "trust_warranty",
  "trust_try_before",
  "trust_google_rating",
  "trust_google_review_count",
  "trust_google_reviews_url",
] as const;
export type TrustKey = (typeof TRUST_KEYS)[number];
export type TrustSettings = Partial<Record<TrustKey, string>>;

export type TrustItem = { key: string; label: string; value: string; href?: string };

const RATING = /^(?:[0-4](?:\.[0-9])?|5(?:\.0)?)$/;
const COUNT = /^[0-9]{1,7}$/;
const URL_RE = /^https:\/\/\S+$/;

/** Validation mirrored from the site_settings check constraints. Returns an error message or null. */
export function validateTrustSetting(key: TrustKey, value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (v.length > 160) return "Keep it under 160 characters";
  if (key === "trust_google_rating" && !RATING.test(v)) return "Rating is a number from 0 to 5, e.g. 4.9";
  if (key === "trust_google_review_count" && !COUNT.test(v)) return "Review count is a whole number";
  if (key === "trust_google_reviews_url" && !URL_RE.test(v)) return "Use the https:// link to your Google reviews";
  return null;
}

/** Turn raw settings into the items to show, skipping anything unset or invalid. Never fills gaps. */
export function trustItems(s: TrustSettings): TrustItem[] {
  const out: TrustItem[] = [];
  const get = (k: TrustKey) => {
    const v = s[k]?.trim();
    return v && !validateTrustSetting(k, v) ? v : "";
  };
  const rating = get("trust_google_rating");
  if (rating) {
    const count = get("trust_google_review_count");
    const url = get("trust_google_reviews_url");
    out.push({
      key: "google",
      label: "Google rating",
      value: `${Number(rating).toFixed(1)} ★${count ? ` from ${Number(count).toLocaleString("en-AU")} reviews` : ""}`,
      href: url || undefined,
    });
  }
  const tryBefore = get("trust_try_before");
  if (tryBefore) out.push({ key: "try", label: "Try before you buy", value: tryBefore });
  const lead = get("trust_lead_time");
  if (lead) out.push({ key: "lead", label: "Typical lead time", value: lead });
  const warranty = get("trust_warranty");
  if (warranty) out.push({ key: "warranty", label: "Warranty", value: warranty });
  return out;
}

export async function fetchTrustSettings(): Promise<TrustSettings> {
  const { data, error } = await supabase.from("site_settings").select("key, value");
  if (error) throw error;
  const out: TrustSettings = {};
  for (const row of (data ?? []) as { key: string; value: string }[]) {
    if ((TRUST_KEYS as readonly string[]).includes(row.key)) out[row.key as TrustKey] = row.value;
  }
  return out;
}

/** Admin only (RLS). Empty value deletes the key so the bar hides it. */
export async function saveTrustSettings(next: TrustSettings): Promise<void> {
  const upserts: { key: string; value: string }[] = [];
  const deletes: string[] = [];
  for (const key of TRUST_KEYS) {
    const v = (next[key] ?? "").trim();
    const err = validateTrustSetting(key, v);
    if (err) throw new Error(err);
    if (v) upserts.push({ key, value: v });
    else deletes.push(key);
  }
  if (upserts.length) {
    const { error } = await supabase.from("site_settings").upsert(upserts, { onConflict: "key" });
    if (error) throw error;
  }
  if (deletes.length) {
    const { error } = await supabase.from("site_settings").delete().in("key", deletes);
    if (error) throw error;
  }
}
