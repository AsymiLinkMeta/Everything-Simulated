import { createFileRoute, Link } from "@tanstack/react-router";
import { JsonLd } from "@/components/es/bits";
import { CtaStrip, ImageCards, PageHero, SectionLinks } from "@/components/es/section-page";
import { TRAINING_PAGES } from "@/lib/es/platforms";
import { breadcrumbLd, pageHead } from "@/lib/es/seo";

export const Route = createFileRoute("/_site/training/")({
  head: () =>
    pageHead({
      title: "Simulator training | Driver, industrial, aviation | Everything Simulated",
      description: "Motorsport, driver, industrial and vehicle training programs on Gold Coast assembled simulators. Group sessions for professional and amateur drivers at the planned warehouse.",
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
        title="Hours before the real thing."
        lead="Motorsport and juniors already run on four-screen racing crates. Group days for professional and amateur drivers sit on the warehouse floor — enquire. Truck, side-kart and excavator work is capacity."
        image="/rigs/starter.jpg"
      />
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
        <CtaStrip title="Programs, not a second shop." lead="Hardware lives under Racing. Hours live here.">
          <Link to="/studio" className="es-btn">Book the studio</Link>
          <Link to="/contact" className="es-btn es-btn-paper">Enquire</Link>
        </CtaStrip>
      </div>
    </div>
  );
}
