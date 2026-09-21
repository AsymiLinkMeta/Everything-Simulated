import { createFileRoute, Link } from "@tanstack/react-router";
import { JsonLd } from "@/components/es/bits";
import { ImageCards, PageHero, PhoneStrip, SectionLinks } from "@/components/es/section-page";
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
      >
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link to="/events" className="es-btn">Group days</Link>
          <Link to="/studio" className="es-btn es-btn-paper">Studio</Link>
        </div>
      </PageHero>
      <div className="es-body">
        <SectionLinks links={TRAINING_PAGES} current="/training/driver" tone="race" />
        <p className="mt-8 max-w-2xl text-sm text-muted">
          Hardware lives under Racing — Starter or Haptic unless a coach asks for motion. One-to-one programs live here. Named drivers sit under Ambassadors.
        </p>
        <div className="mt-10">
          <ImageCards
            cards={[
              { to: "/racing", image: "/rigs/motion.jpg", kicker: "Hardware", title: "Racing tools", hint: "The crates the program runs on." },
              { to: "/events", image: "/rigs/showroom.jpg", kicker: "Groups", title: "Group days", hint: "Professional and amateur sessions at the warehouse." },
              { to: "/ambassadors", image: "/rigs/haptic.jpg", kicker: "People", title: "Ambassadors", hint: "Drivers the workshop stands with." },
            ]}
          />
        </div>
        <PhoneStrip title="Bring a squad." lead="We treat it as an event on the warehouse floor." />
      </div>
    </div>
  );
}
