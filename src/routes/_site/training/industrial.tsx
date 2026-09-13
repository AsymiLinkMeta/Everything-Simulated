import { createFileRoute, Link } from "@tanstack/react-router";
import { JsonLd } from "@/components/es/bits";
import { PageHero, SectionLinks } from "@/components/es/section-page";
import { TRAINING_PAGES } from "@/lib/es/platforms";
import { breadcrumbLd, pageHead } from "@/lib/es/seo";

export const Route = createFileRoute("/_site/training/industrial")({
  head: () =>
    pageHead({
      title: "Industrial and vehicle training simulators | Everything Simulated",
      description:
        "Plant, truck, side-kart and excavator training simulators assembled on the Gold Coast. Enquire for a spec — not a public catalogue.",
      path: "/training/industrial",
    }),
  component: IndustrialTraining,
});

function IndustrialTraining() {
  return (
    <div>
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Training", path: "/training" },
          { name: "Industrial", path: "/training/industrial" },
        ])}
      />
      <PageHero
        kicker="Industrial"
        title="Not every vehicle is a race car."
        lead="Plant, heavy vehicle, truck, side-kart and excavator programs. We spec controls, visuals and room with you. No public SKU list — enquire."
        image="/rigs/starter.jpg"
        tone="adventure"
      />
      <div className="es-body">
        <SectionLinks links={TRAINING_PAGES} current="/training/industrial" tone="adventure" />
        <p className="mt-8 max-w-2xl text-sm text-muted">
          Same Gold Coast assembly and crate freight as racing. Different cab, different software, same workshop photos before it ships.
        </p>
        <Link to="/contact" className="es-btn mt-8 inline-flex">
          Enquire
        </Link>
      </div>
    </div>
  );
}
