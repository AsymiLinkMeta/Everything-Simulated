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
        "Kart, junior and motorsport driver training on Gold Coast racing simulators. Solo studio fitting, or group days for professional and amateur drivers at the planned warehouse.",
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
        lead="Juniors and race drivers already use the racing crates. Pedal spacing, torque caps and a four-screen coaching layout are set in the studio before the crate leaves. Groups — professional or amateur — run as warehouse events."
        image="/rigs/haptic.jpg"
        tone="race"
      />
      <div className="es-body">
        <SectionLinks links={TRAINING_PAGES} current="/training/driver" tone="race" />
        <p className="mt-8 max-w-2xl text-sm text-muted">
          Hardware lives under Racing — Starter or Haptic unless a coach asks for motion. One-to-one programs live here. Named drivers sit under Ambassadors. Bring a squad and we treat it as an event on the warehouse floor.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/racing" className="es-btn">
            Racing tools
          </Link>
          <Link to="/events" className="es-btn es-btn-paper">
            Group days
          </Link>
          <Link to="/ambassadors" className="es-btn es-btn-paper">
            Ambassadors
          </Link>
        </div>
      </div>
    </div>
  );
}
