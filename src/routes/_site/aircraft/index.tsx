import { createFileRoute, Link } from "@tanstack/react-router";
import { JsonLd } from "@/components/es/bits";
import { ImageCards, PageHero, PhoneStrip, SectionLinks } from "@/components/es/section-page";
import { AIRCRAFT_PAGES } from "@/lib/es/platforms";
import { breadcrumbLd, pageHead } from "@/lib/es/seo";

export const Route = createFileRoute("/_site/aircraft/")({
  head: () =>
    pageHead({
      title: "Aircraft & Cockpit Simulators | Helicopter & Fixed-Wing | Everything Simulated",
      description: "Custom helicopter and fixed-wing cockpit simulators assembled on the Gold Coast. Book a studio consultation, then we build and ship Australia-wide.",
      path: "/aircraft",
    }),
  component: AircraftHub,
});

function AircraftHub() {
  return (
    <div>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Aircraft", path: "/aircraft" }])} />
      <PageHero
        kicker="Aircraft · workshop platform"
        title="Aircraft & Cockpit Simulators"
        lead="Helicopter and fixed-wing cockpits built on the same Gold Coast floor as our racing simulators. Every aircraft build starts with a studio consultation."
        image="/rigs/showroom.jpg"
      >
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link to="/contact" className="es-btn">Enquire</Link>
          <Link to="/studio" className="es-btn es-btn-paper">Studio consult</Link>
        </div>
      </PageHero>
      <div className="es-body">
        <SectionLinks links={AIRCRAFT_PAGES} current="/aircraft" />
        <div className="mt-10">
          <ImageCards
            cards={[
              { to: "/aircraft/helicopter", image: "/rigs/showroom.jpg", kicker: "Rotary", title: "Helicopter", hint: "Collective, cyclic and anti-torque layouts for rehearsal." },
              { to: "/aircraft/flight", image: "/rigs/motion.jpg", kicker: "Fixed-wing", title: "Flight", hint: "Same workshop, different controls. Enquire, not a catalogue." },
              { to: "/studio", image: "/rigs/haptic.jpg", kicker: "Studio", title: "Sit the layout", hint: "Gold Coast consult before anything crates." },
            ]}
          />
        </div>
        <PhoneStrip title="Consultation First" lead="Aircraft builds are quoted individually. Contact us to discuss your requirements." />
      </div>
    </div>
  );
}
