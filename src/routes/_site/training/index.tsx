import { createFileRoute } from "@tanstack/react-router";
import { JsonLd } from "@/components/es/bits";
import { PageHero, SectionLinks, ToolCards } from "@/components/es/section-page";
import { TRAINING_PAGES } from "@/lib/es/platforms";
import { breadcrumbLd, pageHead } from "@/lib/es/seo";

export const Route = createFileRoute("/_site/training/")({
  head: () =>
    pageHead({
      title: "Simulator training | Driver, industrial, aviation | Everything Simulated",
      description:
        "Motorsport, driver, industrial and vehicle training programs on Gold Coast assembled simulators. Four-screen coaching on racing crates. Aircraft and drone platforms underneath.",
      path: "/training",
    }),
  component: TrainingHub,
});

function TrainingHub() {
  return (
    <div>
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Training", path: "/training" },
        ])}
      />
      <PageHero
        kicker="Training · programs"
        title="Hours before the real thing."
        lead="Motorsport and junior drivers already run on four-screen racing crates. Industrial plant, truck, side-kart and excavator work is workshop capacity — enquire, do not expect a shop."
        image="/rigs/starter.jpg"
        tone="adventure"
      />
      <div className="es-body">
        <SectionLinks links={TRAINING_PAGES} current="/training" tone="adventure" />
        <div className="mt-10">
          <ToolCards
            tone="adventure"
            links={[
              { to: "/training/driver", label: "Driver training", hint: "Kart, road, junior pathway, motorsport." },
              { to: "/training/industrial", label: "Industrial", hint: "Plant, truck, side-kart, excavator — enquire." },
              { to: "/aircraft", label: "Aviation platforms", hint: "Helicopter and flight cockpits used for rehearsal." },
              { to: "/drones", label: "Drone platforms", hint: "FPV and ground-station trainers." },
              { to: "/racing", label: "Racing platforms", hint: "The live crates juniors already train on." },
              { to: "/studio", label: "Studio", hint: "Book a Gold Coast session with Taylah." },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
