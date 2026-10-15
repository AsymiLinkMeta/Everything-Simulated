import { Link } from "@tanstack/react-router";
import { useCart } from "@/lib/es/cart-store";
import type { Ambassador } from "@/lib/es/ambassadors";
import { crateForAmbassador } from "@/lib/es/ambassadors";
import { fetchPublishedPrebuilds, getCachedPrebuilds, resolvePrebuildSlug } from "@/lib/es/prebuilds";

export function armAmbassadorRig(ambassador: Ambassador) {
  const crate = crateForAmbassador(ambassador);
  useCart.getState().setReferralCode(ambassador.code);
  if (!crate) return null;
  useCart.getState().setLines(crate.lines, null, crate.slug);
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
  // While the prebuild list is still loading, show the link from the ambassador's own crate slug
  // so the hero doesn't grow (and shift) when the list arrives. Arm the cart once it has loaded.
  const pending = !crate && !checkout && Boolean(ambassador.crate) && getCachedPrebuilds().length === 0;
  if (pending) {
    return (
      <Link
        to="/prebuilds/$slug"
        params={{ slug: resolvePrebuildSlug(ambassador.crate!) }}
        className="es-btn"
        onClick={() => {
          void fetchPublishedPrebuilds().then(() => armAmbassadorRig(ambassador)).catch(() => {});
        }}
      >
        {children ?? "Order this rig"}
      </Link>
    );
  }
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
      className="es-btn"
      onClick={() => {
        armAmbassadorRig(ambassador);
      }}
    >
      {children ?? "Order this rig"}
    </Link>
  );
}
