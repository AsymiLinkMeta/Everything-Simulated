import { createFileRoute, Link } from "@tanstack/react-router";
import { JsonLd } from "@/components/es/bits";
import { PageIntro, SectionLinks } from "@/components/es/section-page";
import { TRAINING_PAGES } from "@/lib/es/platforms";
import { breadcrumbLd, pageHead } from "@/lib/es/seo";

export const Route = createFileRoute("/_site/training/driver")({
  head: () =>
    pageHead({
      title: "Driver training simulators | Everything Simulated",
      description:
        "Kart, junior and motorsport driver training on Gold Coast racing simulators. Studio fitting, then a crate.",
      path: "/training/driver",
    }),
  component: DriverTraining,
});

function DriverTraining() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl overflow-x-hidden px-4 py-16">
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Training", path: "/training" },
          { name: "Driver", path: "/training/driver" },
        ])}
      />
      <SectionLinks links={TRAINING_PAGES} current="/training/driver" />
      <PageIntro
        kicker="Driver"
        title="Driver training."
        lead="Juniors, karting and motorsport drivers already use the racing crates. Pedal spacing, torque caps and a coaching screen are set in the studio before the crate leaves."
      />
      <p className="mt-8 max-w-2xl text-sm text-muted">
        Hardware lives under Racing — Starter or Haptic unless a coach asks for motion. The program (hours, coaching, junior pathway) lives here.
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
  );
}
