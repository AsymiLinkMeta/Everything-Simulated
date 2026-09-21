import { createFileRoute, Link } from "@tanstack/react-router";
import { JsonLd } from "@/components/es/bits";
import { ImageCards, PageHero, PhoneStrip, SectionLinks } from "@/components/es/section-page";
import { AIRCRAFT_PAGES } from "@/lib/es/platforms";
import { breadcrumbLd, pageHead } from "@/lib/es/seo";

export const Route = createFileRoute("/_site/aircraft/")({
  head: () =>
    pageHead({
      title: "Aircraft simulators | Helicopter and flight | Everything Simulated",
      description: "Gold Coast assembled helicopter and fixed-wing simulator cockpits. Studio consult, then a crate Australia-wide — capacity, not a fake catalogue.",
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
        title="Cockpits from the same floor."
        lead="Racing is the live catalogue. Aircraft is workshop capacity — rotary first — then assembled on the Gold Coast."
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
        <PhoneStrip title="Capacity is consult-first." lead="The racing checker does not apply here." />
      </div>
    </div>
  );
}
