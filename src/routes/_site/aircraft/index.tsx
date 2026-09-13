import { createFileRoute, Link } from "@tanstack/react-router";
import { JsonLd } from "@/components/es/bits";
import { PageHero, SectionLinks } from "@/components/es/section-page";
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
      />
      <div className="es-chapter-row">
        <Link to="/aircraft/helicopter" className="es-chapter">
          <img src="/rigs/showroom.jpg" alt="" />
          <div className="es-chapter-veil" />
          <div className="es-chapter-copy">
            <span className="es-chapter-idx">01</span>
            <p className="es-kicker es-kicker-telemetry">Rotary</p>
            <h2>Helicopter</h2>
            <p>Collective, cyclic and anti-torque layouts for rehearsal.</p>
          </div>
        </Link>
        <Link to="/aircraft/flight" className="es-chapter">
          <img src="/rigs/motion.jpg" alt="" />
          <div className="es-chapter-veil" />
          <div className="es-chapter-copy">
            <span className="es-chapter-idx">02</span>
            <p className="es-kicker es-kicker-telemetry">Fixed-wing</p>
            <h2>Flight</h2>
            <p>Same workshop, different controls. Enquire, not a catalogue.</p>
          </div>
        </Link>
        <Link to="/studio" className="es-chapter">
          <img src="/rigs/haptic.jpg" alt="" />
          <div className="es-chapter-veil" />
          <div className="es-chapter-copy">
            <span className="es-chapter-idx">03</span>
            <p className="es-kicker es-kicker-telemetry">Studio</p>
            <h2>Sit the layout</h2>
            <p>Gold Coast consult before anything crates.</p>
          </div>
        </Link>
      </div>
      <div className="es-body">
        <SectionLinks links={AIRCRAFT_PAGES} current="/aircraft" />
        <p className="mt-8 max-w-2xl text-sm text-muted">Capacity is consult-first. The racing checker does not apply here.</p>
        <Link to="/contact" className="es-btn mt-6 inline-flex">Talk to the workshop</Link>
      </div>
    </div>
  );
}
