import { createFileRoute, Link } from "@tanstack/react-router";
import { JsonLd } from "@/components/es/bits";
import { ImageCards, PageHero, PhoneStrip, SectionLinks } from "@/components/es/section-page";
import { TRAINING_PAGES } from "@/lib/es/platforms";
import { breadcrumbLd, pageHead } from "@/lib/es/seo";

export const Route = createFileRoute("/_site/training/driver")({
  head: () =>
    pageHead({
      title: "Motorsport & Junior Driver Training Simulators | Everything Simulated",
      description:
        "Kart, junior and motorsport driver training on Gold Coast racing simulators. Four-screen coaching layout, adjustable ergonomics and torque-limited setups for young drivers.",
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
        title="Motorsport & Junior Driver Training"
        lead="Juniors and race drivers already train on our four-screen racing simulators. Pedal spacing, torque limits and coaching displays are fitted in the studio before dispatch. Group sessions for professional and amateur drivers run as warehouse events."
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
        <PhoneStrip title="Book a Group Session" lead="Group training runs as an event at the warehouse. Contact us with your requirements." />
      </div>
    </div>
  );
}
