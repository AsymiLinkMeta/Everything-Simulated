import { createFileRoute, Link } from "@tanstack/react-router";
import { JsonLd } from "@/components/es/bits";
import { PageIntro, SectionLinks } from "@/components/es/section-page";
import { TRAINING_PAGES } from "@/lib/es/platforms";
import { breadcrumbLd, pageHead } from "@/lib/es/seo";

export const Route = createFileRoute("/_site/training/industrial")({
  head: () =>
    pageHead({
      title: "Industrial and vehicle training simulators | Everything Simulated",
      description:
        "Plant, heavy vehicle and industrial training simulators assembled on the Gold Coast. Enquire for a spec.",
      path: "/training/industrial",
    }),
  component: IndustrialTraining,
});

function IndustrialTraining() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl overflow-x-hidden px-4 py-16">
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Training", path: "/training" },
          { name: "Industrial", path: "/training/industrial" },
        ])}
      />
      <SectionLinks links={TRAINING_PAGES} current="/training/industrial" />
      <PageIntro
        kicker="Industrial"
        title="Industrial and vehicle training."
        lead="Plant, heavy vehicle and other vehicle programs that do not belong on a race chassis. We spec controls, visuals and room with you. No public SKU list — enquire."
      />
      <p className="mt-8 max-w-2xl text-sm text-muted">
        Same Gold Coast assembly and crate freight as racing. Different cab, different software, same workshop photos before it ships.
      </p>
      <Link to="/contact" className="es-btn mt-8 inline-flex">
        Enquire
      </Link>
    </div>
  );
}
