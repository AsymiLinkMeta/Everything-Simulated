import { Link } from "@tanstack/react-router";
import { packageBySlug } from "@/lib/es/catalog";
import { useCart } from "@/lib/es/cart-store";
import type { Ambassador } from "@/lib/es/ambassadors";
import { crateForAmbassador } from "@/lib/es/ambassadors";

export function armAmbassadorRig(ambassador: Ambassador) {
  const crate = crateForAmbassador(ambassador);
  useCart.getState().setReferralCode(ambassador.code);
  if (!crate) return null;
  useCart.getState().loadPackage(crate.slug);
  if (!useCart.getState().lines.length) {
    const pack = packageBySlug(crate.slug);
    if (pack) useCart.getState().setLines(pack.lines);
  }
  return crate;
}

export function OrderRigButton({
  ambassador,
  checkout = false,
  children,
}: {
  ambassador: Ambassador;
  checkout?: boolean;
  children?: string;
}) {
  const crate = crateForAmbassador(ambassador);
  if (!crate) return null;

  if (checkout) {
    return (
      <Link
        to="/checkout"
        className="es-btn"
        onClick={() => {
          armAmbassadorRig(ambassador);
        }}
      >
        {children ?? "Order this rig"}
      </Link>
    );
  }

  return (
    <Link
      to="/prebuilds/$slug"
      params={{ slug: crate.slug }}
      search={{ ref: ambassador.code }}
      className="es-btn"
      onClick={() => {
        armAmbassadorRig(ambassador);
      }}
    >
      {children ?? "Order this rig"}
    </Link>
  );
}
