import { createFileRoute } from "@tanstack/react-router";
import { JsonLd } from "@/components/es/bits";
import { PageIntro, SectionLinks, ToolCards } from "@/components/es/section-page";
import { TRAINING_PAGES } from "@/lib/es/platforms";
import { breadcrumbLd, pageHead } from "@/lib/es/seo";

export const Route = createFileRoute("/_site/training/")({
  head: () =>
    pageHead({
      title: "Simulator training | Driver, industrial, aviation | Everything Simulated",
      description:
        "Driver, industrial and vehicle training programs on Gold Coast assembled simulators. Racing, aircraft and drone platforms underneath.",
      path: "/training",
    }),
  component: TrainingHub,
});

function TrainingHub() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl overflow-x-hidden px-4 py-16">
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Training", path: "/training" },
        ])}
      />
      <SectionLinks links={TRAINING_PAGES} current="/training" />
      <PageIntro
        kicker="Training"
        title="Any vehicle that needs hours before the real one."
        lead="Training is the program layer. The hardware is racing, aircraft or drone. Driver development, industrial plant and other vehicle work all sit here — one workshop, not a separate brand."
      />
      <div className="mt-10">
        <ToolCards
          links={[
            { to: "/training/driver", label: "Driver training", hint: "Kart, road, junior pathway, motorsport." },
            { to: "/training/industrial", label: "Industrial", hint: "Plant, heavy vehicle, other vehicle programs." },
            { to: "/aircraft", label: "Aviation platforms", hint: "Helicopter and flight cockpits used for rehearsal." },
            { to: "/drones", label: "Drone platforms", hint: "FPV and ground-station trainers." },
            { to: "/racing", label: "Racing platforms", hint: "The live crates juniors already train on." },
            { to: "/studio", label: "Studio", hint: "Book a Gold Coast session." },
          ]}
        />
      </div>
    </div>
  );
}
