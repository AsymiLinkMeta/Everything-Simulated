import { createFileRoute, Link } from "@tanstack/react-router";
import { JsonLd } from "@/components/es/bits";
import { PageIntro, SectionLinks } from "@/components/es/section-page";
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
    <div className="mx-auto w-full min-w-0 max-w-6xl overflow-x-hidden px-4 py-16">
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Aircraft", path: "/aircraft" },
          { name: "Fixed-wing", path: "/aircraft/flight" },
        ])}
      />
      <SectionLinks links={AIRCRAFT_PAGES} current="/aircraft/flight" />
      <PageIntro
        kicker="Fixed-wing"
        title="Flight simulators."
        lead="Fixed-wing and jet trainer cockpits. Same Gold Coast workshop as racing and rotary — different controls, same crate discipline."
      />
      <ul className="mt-10 max-w-2xl space-y-3 text-sm text-muted">
        <li>Specced to the airframe you train on. We do not invent a stock SKU list here.</li>
        <li>Visuals, controls and motion are a consult. Studio first if you can travel.</li>
        <li>For programs and curriculum, see Training.</li>
      </ul>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/training" className="es-btn">
          Training programs
        </Link>
        <Link to="/contact" className="es-btn es-btn-paper">
          Enquire
        </Link>
      </div>
    </div>
  );
}
