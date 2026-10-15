/**
 * The one public host used for canonicals, Open Graph, JSON-LD and the sitemap.
 * Set VITE_SITE_URL per environment (staging, production). Defaults to the live
 * production host, which the bare domain 301-redirects to.
 */
export const DEFAULT_SITE_ORIGIN = "https://www.everythingsimulated.com.au";

export function normaliseOrigin(raw: string | undefined | null, fallback = DEFAULT_SITE_ORIGIN): string {
  const value = String(raw ?? "").trim();
  if (!value) return fallback;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return fallback;
    return url.origin;
  } catch {
    return fallback;
  }
}

export const SITE_ORIGIN = normaliseOrigin(import.meta.env.VITE_SITE_URL);
