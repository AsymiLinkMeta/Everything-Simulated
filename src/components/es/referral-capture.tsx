import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useCart } from "@/lib/es/cart-store";
import { hasReferralConsent, onConsentChange } from "@/lib/es/consent";
import { captureReferral, dropReferralCookies, getCookieReferralCode, getReferralCode, persistHeldReferral } from "@/lib/es/referral";

/**
 * Picks up ?ref=CODE (or ?amb= / ?code=) on any public page and removes the parameter from
 * the address bar so it isn't shared onwards or indexed.
 *  - With referral consent: records a privacy-safe click and sets the 90-day first-party
 *    attribution cookies (last touch); the code is also prefilled in the cart.
 *  - Without (no choice yet, or rejected): the code is held for this visit only and nothing
 *    is written to a cookie or the saved cart. Accepting later replays it (click + cookies).
 */
export function ReferralCapture() {
  const setReferralCode = useCart((s) => s.setReferralCode);
  const { search } = useLocation();

  useEffect(() => {
    let params: URLSearchParams;
    try {
      params = new URLSearchParams(window.location.search);
    } catch {
      return;
    }
    const key = ["ref", "amb", "code"].find((k) => params.get(k));
    if (!key) {
      // Keep the cart in step with an existing attribution cookie.
      const existing = hasReferralConsent() ? getCookieReferralCode() : null;
      if (existing && !useCart.getState().referralCode) setReferralCode(existing);
      return;
    }
    const raw = params.get(key) ?? "";
    params.delete(key);
    const clean = `${window.location.pathname}${params.toString() ? `?${params}` : ""}${window.location.hash}`;
    window.history.replaceState(window.history.state, "", clean);
    void captureReferral(raw, { path: window.location.pathname }).then((code) => {
      if (code && hasReferralConsent()) setReferralCode(code);
    });
  }, [search, setReferralCode]);

  useEffect(
    () =>
      onConsentChange((rec) => {
        if (rec.referral) {
          void persistHeldReferral().then((code) => {
            if (code) setReferralCode(code);
          });
        } else {
          const had = dropReferralCookies() ?? getReferralCode();
          // The saved cart outlives the visit; keep an auto-filled code out of it.
          if (had && useCart.getState().referralCode === had) setReferralCode("");
        }
      }),
    [setReferralCode],
  );

  return null;
}
