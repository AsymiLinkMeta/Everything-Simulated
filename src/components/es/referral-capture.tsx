import { useEffect } from "react";
import { useCart } from "@/lib/es/cart-store";

/** Persist ?ref=CODE from any public URL onto the cart. */
export function ReferralCapture() {
  const setReferralCode = useCart((s) => s.setReferralCode);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get("ref") || params.get("amb") || params.get("code");
      if (raw) setReferralCode(raw);
    } catch {
      /* ignore */
    }
  }, [setReferralCode]);

  return null;
}
