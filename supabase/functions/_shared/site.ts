export const DEFAULT_SITE_URL = "https://www.everythingsimulated.com.au";

/**
 * Normalise SITE_URL to a bare origin. Only https is accepted, except for
 * localhost during development. Anything invalid falls back to the default
 * so a typo can never turn into an open redirect.
 */
export function resolveSiteUrl(raw: string | undefined | null): string {
  const value = String(raw ?? "").trim();
  if (!value) return DEFAULT_SITE_URL;
  try {
    const url = new URL(value);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !(local && url.protocol === "http:")) return DEFAULT_SITE_URL;
    return url.origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

/** Stripe Checkout return URLs, always on our own site. */
export function checkoutReturnUrls(siteUrl: string, orderId: string, email: string) {
  const base = resolveSiteUrl(siteUrl);
  const q = `id=${encodeURIComponent(orderId)}&email=${encodeURIComponent(email)}`;
  return {
    success: `${base}/order?${q}&paid=1`,
    cancel: `${base}/order?${q}&cancelled=1`,
  };
}
