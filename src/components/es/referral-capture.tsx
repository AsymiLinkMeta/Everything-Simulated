import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useCart } from "@/lib/es/cart-store";
import { captureReferral, getReferralCode } from "@/lib/es/referral";

/**
 * Picks up ?ref=CODE (or ?amb= / ?code=) on any public page: records a privacy-safe click,
 * sets the 90-day first-party attribution cookie (last touch), then removes the parameter
 * from the address bar so it isn't shared onwards or indexed.
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
      const existing = getReferralCode();
      if (existing && !useCart.getState().referralCode) setReferralCode(existing);
      return;
    }
    const raw = params.get(key) ?? "";
    params.delete(key);
    const clean = `${window.location.pathname}${params.toString() ? `?${params}` : ""}${window.location.hash}`;
    window.history.replaceState(window.history.state, "", clean);
    void captureReferral(raw, { path: window.location.pathname }).then((code) => {
      if (code) setReferralCode(code);
    });
  }, [search, setReferralCode]);

  return null;
}
