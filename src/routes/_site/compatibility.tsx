import { createFileRoute } from "@tanstack/react-router";
import { CartPanel } from "@/components/es/cart-panel";
import { BuildStudio } from "@/components/es/build-studio";
import { pageHead, breadcrumbLd } from "@/lib/es/seo";
import { JsonLd } from "@/components/es/bits";
import { PageHero } from "@/components/es/section-page";

export const Route = createFileRoute("/_site/compatibility")({
  head: () =>
    pageHead({
      title: "Racing Simulator Compatibility Checker | Everything Simulated",
      description: "Verify your racing simulator build before you buy. Our compatibility engine checks Simagic, Trak Racer, Exodus and SIMRIG components for torque, payload, quick-release and mount clearance.",
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
        title="Racing Simulator Compatibility Checker"
        lead="Select one component at a time. The compatibility engine automatically blocks incompatible combinations before you reach the deposit stage."
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
