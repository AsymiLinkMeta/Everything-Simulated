import { createFileRoute, Link } from "@tanstack/react-router";
import { PackageCard } from "@/components/es/bits";
import { PACKAGES } from "@/lib/es/catalog";
import { pageHead } from "@/lib/es/seo";

export const Route = createFileRoute("/_site/builds/")({
  head: () =>
    pageHead({
      title: "Sim racing builds | Starter, Haptic, Motion | Everything Simulated",
      description:
        "Choose a Gold Coast built racing simulator. Starter $11,260 + GST, Haptic $18,999 + GST, Motion $28,999 + GST with SIMRIG SR2. Australia-wide delivery.",
      path: "/builds",
    }),
  component: Builds,
});

function Builds() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl overflow-x-hidden px-4 py-16">
      <p className="es-kicker">Turn-key</p>
      <h1 className="mt-3 text-4xl font-medium">Three builds. One workshop.</h1>
      <p className="mt-4 max-w-2xl text-muted">
        Every package is assembled, checked and photographed on the Gold Coast. Load a package into
        the checker, swap parts, then save a quote.
      </p>
      <div className="mt-10 grid grid-cols-2 gap-6 md:grid-cols-3">
        {PACKAGES.map((pack) => (
          <PackageCard key={pack.slug} pack={pack} />
        ))}
      </div>
      <p className="mt-10 text-sm text-muted">
        Prefer to spec from parts?{" "}
        <Link to="/shop" className="text-paper">
          Open the shop
        </Link>{" "}
        or{" "}
        <Link to="/compatibility" className="text-paper">
          run the compatibility checker
        </Link>
        .
      </p>
    </div>
  );
}
