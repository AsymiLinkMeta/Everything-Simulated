import { createFileRoute, Link } from "@tanstack/react-router";
import { JsonLd } from "@/components/es/bits";
import { CtaStrip, ImageCards, PageHero, SectionLinks } from "@/components/es/section-page";
import { TRAINING_PAGES } from "@/lib/es/platforms";
import { breadcrumbLd, pageHead } from "@/lib/es/seo";

export const Route = createFileRoute("/_site/training/industrial")({
  head: () =>
    pageHead({
      title: "Industrial & Heavy Vehicle Training Simulators | Everything Simulated",
      description:
        "Custom plant, truck, forklift and excavator training simulators assembled on the Gold Coast. Controls, visuals and environment specced to your operational requirements.",
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
        title="Industrial & Heavy Vehicle Training Simulators"
        lead="Plant, truck, forklift and excavator training simulators. We spec controls, visuals and the operating environment to your requirements. Each build is quoted individually."
        image="/rigs/starter.jpg"
        tone="adventure"
      />
      <div className="es-body">
        <SectionLinks links={TRAINING_PAGES} current="/training/industrial" tone="adventure" />
        <p className="mt-8 max-w-2xl text-sm text-muted">
          Same Gold Coast assembly and crate freight as racing. Different cab, different software, same workshop photos before it ships.
        </p>
        <div className="mt-10">
          <ImageCards
            columns={2}
            cards={[
              { to: "/events", image: "/rigs/showroom.jpg", kicker: "Venue", title: "Group days", hint: "Corporate and training groups on the warehouse floor." },
              { to: "/contact", image: "/rigs/motion.jpg", kicker: "Enquire", title: "Spec the cab", hint: "No public catalogue." },
            ]}
          />
        </div>
        <CtaStrip title="Enquire About Your Build" lead="Every industrial simulator is quoted to your specific operational requirements.">
          <Link to="/contact" className="es-btn">Enquire</Link>
        </CtaStrip>
      </div>
    </div>
  );
}
