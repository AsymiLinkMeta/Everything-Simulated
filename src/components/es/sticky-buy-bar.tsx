import { Link } from "@tanstack/react-router";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/lib/es/cart-store";
import { Money } from "./bits";

/**
 * Mobile-only bar pinned to the bottom of product and prebuild pages: the price,
 * the page's one primary action, and the cart. Hidden from md up, where the
 * price and button already sit beside the photo.
 */
export function StickyBuyBar({
  name,
  priceExGst,
  actionLabel,
  onAction,
  disabled,
}: {
  name: string;
  priceExGst: number | null;
  actionLabel: string;
  onAction: () => void;
  disabled?: boolean;
}) {
  const count = useCart((s) => s.lines.reduce((n, l) => n + l.qty, 0));
  return (
    <>
      <div className="es-sticky-buy-spacer md:hidden" aria-hidden="true" />
      <div className="es-sticky-buy md:hidden" role="region" aria-label="Buy">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-muted">{name}</p>
          <p className="text-base font-medium tabular-nums">
            {priceExGst ? <Money cents={priceExGst} gst /> : "Enquire for price"}
          </p>
        </div>
        <button type="button" className="es-btn es-sticky-buy-action" onClick={onAction} disabled={disabled}>
          {actionLabel}
        </button>
        <Link to="/checkout" className="es-sticky-buy-cart" aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}>
          <ShoppingCart className="size-5" />
          {count > 0 ? <span className="es-cart-count">{count}</span> : null}
        </Link>
      </div>
    </>
  );
}
