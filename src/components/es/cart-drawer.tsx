import { lazy, Suspense, useEffect, useRef } from "react";
import { useLocation } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useCartDrawer } from "@/lib/es/cart-drawer-store";

// The panel pulls in the catalogue and quote code; load it only when the drawer opens.
const CartPanel = lazy(() => import("./cart-panel").then((m) => ({ default: m.CartPanel })));

/** Right-hand cart drawer. Mounted once in the site shell; nothing loads until it opens. */
export function CartDrawer() {
  const open = useCartDrawer((s) => s.open);
  const hide = useCartDrawer((s) => s.hide);
  const location = useLocation();
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    hide();
  }, [location.pathname, hide]);

  useEffect(() => {
    if (!open) return;
    returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    document.body.classList.add("ds-lock");
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && hide();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.classList.remove("ds-lock");
      const back = returnTo.current;
      if (back && document.contains(back)) back.focus();
    };
  }, [open, hide]);

  if (!open) return null;
  return (
    <>
      <div className="ds-scrim" onClick={hide} aria-hidden="true" />
      <aside className="ds-drawer" role="dialog" aria-modal="true" aria-labelledby="ds-cart-title" data-testid="cart-drawer">
        <div className="ds-drawer-head">
          <h2 id="ds-cart-title">Your cart</h2>
          <button ref={closeRef} type="button" className="ds-icon-btn" onClick={hide} aria-label="Close cart">
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <div className="ds-drawer-body">
          <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-raised" />}>
            <CartPanel drawer compact />
          </Suspense>
        </div>
      </aside>
    </>
  );
}
