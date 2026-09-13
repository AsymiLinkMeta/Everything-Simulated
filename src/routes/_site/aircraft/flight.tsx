import { createFileRoute, Link } from "@tanstack/react-router";
import { JsonLd } from "@/components/es/bits";
import { PageHero, SectionLinks } from "@/components/es/section-page";
import { AIRCRAFT_PAGES } from "@/lib/es/platforms";
import { breadcrumbLd, pageHead } from "@/lib/es/seo";

export const Route = createFileRoute("/_site/aircraft/flight")({
  head: () =>
    pageHead({
      title: "Fixed-wing flight simulators | Everything Simulated",
      description:
        "Fixed-wing and jet trainer cockpits assembled on the Gold Coast. Studio consult, then crate freight Australia-wide.",
      path: "/aircraft/flight",
    }),
  component: FlightPage,
});

function FlightPage() {
  return (
    <div>
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Aircraft", path: "/aircraft" },
          { name: "Fixed-wing", path: "/aircraft/flight" },
        ])}
      />
      <PageHero
        kicker="Fixed-wing"
        title="Flight simulators."
        lead="Fixed-wing and jet trainer cockpits. Same Gold Coast workshop as racing and rotary — different controls, same crate discipline."
        image="/rigs/showroom.jpg"
        tone="adventure"
      />
      <div className="es-body">
        <SectionLinks links={AIRCRAFT_PAGES} current="/aircraft/flight" tone="adventure" />
        <ul className="es-rail mt-10 max-w-2xl">
          <li className="es-rail-step">
            <strong>Airframe first</strong>
            <span>Specced to what you train on. No invented stock SKU list.</span>
          </li>
          <li className="es-rail-step">
            <strong>Studio if you can travel</strong>
            <span>Visuals, controls and motion are a consult before anything crates.</span>
          </li>
          <li className="es-rail-step">
            <strong>Programs live under Training</strong>
            <span>Curriculum and hours sit next door. This page is the cockpit.</span>
          </li>
        </ul>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/training" className="es-btn">
            Training programs
          </Link>
          <Link to="/contact" className="es-btn es-btn-paper">
            Enquire
          </Link>
        </div>
      </div>
    </div>
  );
}
