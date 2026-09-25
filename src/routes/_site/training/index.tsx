import { createFileRoute, Link } from "@tanstack/react-router";
import { JsonLd } from "@/components/es/bits";
import { ImageCards, PageHero, PhoneStrip, SectionLinks } from "@/components/es/section-page";
import { TRAINING_PAGES } from "@/lib/es/platforms";
import { breadcrumbLd, pageHead } from "@/lib/es/seo";

export const Route = createFileRoute("/_site/training/")({
  head: () =>
    pageHead({
      title: "Simulator Training Programs | Driver, Industrial & Aviation | Everything Simulated",
      description: "Professional simulator training for motorsport drivers, juniors, corporate groups and industrial operators. Gold Coast facility with four-screen coaching rigs and Australia-wide delivery.",
      path: "/training",
    }),
  component: TrainingHub,
});

function TrainingHub() {
  return (
    <div>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Training", path: "/training" }])} />
      <PageHero
        kicker="Training · programs"
        title="Simulator Training Programs"
        lead="Motorsport and junior drivers already train on four-screen racing simulators. Group sessions for professional and amateur drivers run from the warehouse floor. Industrial and heavy-vehicle programs are available by consultation."
        image="/rigs/starter.jpg"
      >
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link to="/training/driver" className="es-btn">Driver programs</Link>
          <Link to="/events" className="es-btn es-btn-paper">Group days</Link>
        </div>
      </PageHero>
      <div className="es-body">
        <SectionLinks links={TRAINING_PAGES} current="/training" />
        <div className="mt-10">
          <ImageCards
            cards={[
              { to: "/training/driver", image: "/rigs/haptic.jpg", kicker: "Driver", title: "Kart. Road. Motorsport.", hint: "Four-screen coaching on the racing crates." },
              { to: "/events", image: "/rigs/showroom.jpg", kicker: "Groups", title: "Pro and amateur days", hint: "Warehouse group training plus catering. Enquire, not a calendar." },
              { to: "/training/industrial", image: "/rigs/starter.jpg", kicker: "Industrial", title: "Plant and heavy vehicle", hint: "Truck, side-kart, excavator — enquire, not a shop." },
            ]}
          />
        </div>
        <PhoneStrip title="Training, Not a Parts Shop" lead="Simulator hardware is listed under Racing. Training hours and coaching programs are managed here." />
      </div>
    </div>
  );
}
