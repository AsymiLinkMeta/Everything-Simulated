import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useCart } from "@/lib/es/cart-store";

/** Persist ?ref=CODE from any public URL onto the cart. */
export function ReferralCapture() {
  const setReferralCode = useCart((s) => s.setReferralCode);
  const location = useLocation();

  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search);
      const raw = params.get("ref") || params.get("amb") || params.get("code");
      if (raw) setReferralCode(raw);
    } catch {
      /* ignore */
    }
  }, [location.search, setReferralCode]);

  return null;
}
