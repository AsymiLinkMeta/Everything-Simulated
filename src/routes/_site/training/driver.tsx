import { createFileRoute, Link } from "@tanstack/react-router";
import { JsonLd } from "@/components/es/bits";
import { PageHero, SectionLinks } from "@/components/es/section-page";
import { TRAINING_PAGES } from "@/lib/es/platforms";
import { breadcrumbLd, pageHead } from "@/lib/es/seo";

export const Route = createFileRoute("/_site/training/driver")({
  head: () =>
    pageHead({
      title: "Driver training simulators | Everything Simulated",
      description:
        "Kart, junior and motorsport driver training on Gold Coast racing simulators with four-screen coaching layouts. Studio fitting, then a crate.",
      path: "/training/driver",
    }),
  component: DriverTraining,
});

function DriverTraining() {
  return (
    <div>
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Training", path: "/training" },
          { name: "Driver", path: "/training/driver" },
        ])}
      />
      <PageHero
        kicker="Driver"
        title="Kart. Road. Motorsport."
        lead="Juniors and race drivers already use the racing crates. Pedal spacing, torque caps and a four-screen coaching layout are set in the studio before the crate leaves."
        image="/rigs/haptic.jpg"
        tone="race"
      />
      <div className="es-body">
        <SectionLinks links={TRAINING_PAGES} current="/training/driver" tone="race" />
        <p className="mt-8 max-w-2xl text-sm text-muted">
          Hardware lives under Racing — Starter or Haptic unless a coach asks for motion. The program lives here. Named driver programs sit under People.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/racing" className="es-btn">
            Racing tools
          </Link>
          <Link to="/drivers" className="es-btn es-btn-paper">
            Sponsored drivers
          </Link>
        </div>
      </div>
    </div>
  );
}
