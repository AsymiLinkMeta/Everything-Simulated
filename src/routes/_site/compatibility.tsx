import { createFileRoute } from "@tanstack/react-router";
import { CartPanel } from "@/components/es/cart-panel";
import { BuildStudio } from "@/components/es/build-studio";
import { pageHead, breadcrumbLd } from "@/lib/es/seo";
import { JsonLd } from "@/components/es/bits";
import { PageHero } from "@/components/es/section-page";

export const Route = createFileRoute("/_site/compatibility")({
  head: () =>
    pageHead({
      title: "Sim racing compatibility checker Australia | Everything Simulated",
      description: "Check Simagic, Trak Racer, Exodus and SIMRIG builds before you buy. Torque, payload, QR and mounts are enforced by rules — not guessed by chat.",
      path: "/compatibility",
    }),
  component: Compatibility,
});

function Compatibility() {
  return (
    <div>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Compatibility checker", path: "/compatibility" }])} />
      <PageHero
        kicker="Build engine"
        title="Spec a compatible crate."
        lead="One category at a time. The checker blocks a bad mix before deposit — chat can explain a result, it cannot override it."
        image="/rigs/motion.jpg"
      />
      <div className="es-body grid min-w-0 gap-8 lg:grid-cols-[1fr_360px]">
        <BuildStudio />
        <div className="lg:sticky lg:top-24 lg:self-start">
          <CartPanel />
        </div>
      </div>
    </div>
  );
}
