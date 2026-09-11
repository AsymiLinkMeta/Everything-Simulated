import { createFileRoute } from "@tanstack/react-router";
import { CartPanel } from "@/components/es/cart-panel";
import { BuildStudio } from "@/components/es/build-studio";
import { pageHead, breadcrumbLd } from "@/lib/es/seo";
import { JsonLd } from "@/components/es/bits";

export const Route = createFileRoute("/_site/compatibility")({
  head: () =>
    pageHead({
      title: "Sim racing compatibility checker Australia | Everything Simulated",
      description:
        "Check Simagic, Trak Racer, Exodus and SIMRIG builds before you buy. Torque, payload, QR and mounts are enforced by rules — not guessed by chat.",
      path: "/compatibility",
    }),
  component: Compatibility,
});

function Compatibility() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl overflow-x-hidden px-4 py-16">
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Compatibility checker", path: "/compatibility" },
        ])}
      />
      <p className="es-kicker">Build engine</p>
      <h1 className="mt-3 text-4xl font-medium">Spec a compatible crate</h1>
      <p className="mt-4 max-w-2xl text-muted">
        One category at a time. Chassis, then torque, then the rest. The checker blocks a bad mix
        before deposit — the chatbot can explain a result, it cannot override it.
      </p>
      <div className="mt-10 grid min-w-0 gap-8 lg:grid-cols-[1fr_360px]">
        <BuildStudio />
        <div className="lg:sticky lg:top-24 lg:self-start">
          <CartPanel />
        </div>
      </div>
    </div>
  );
}
