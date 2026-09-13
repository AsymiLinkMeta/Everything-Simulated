import { createFileRoute, Link } from "@tanstack/react-router";
import { JsonLd } from "@/components/es/bits";
import { PageIntro, SectionLinks, ToolCards } from "@/components/es/section-page";
import { AIRCRAFT_PAGES } from "@/lib/es/platforms";
import { breadcrumbLd, pageHead } from "@/lib/es/seo";

export const Route = createFileRoute("/_site/aircraft/")({
  head: () =>
    pageHead({
      title: "Aircraft simulators | Helicopter and flight | Everything Simulated",
      description:
        "Gold Coast assembled helicopter and fixed-wing simulator cockpits. Studio consult, then a crate Australia-wide — capacity, not a fake catalogue.",
      path: "/aircraft",
    }),
  component: AircraftHub,
});

function AircraftHub() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl overflow-x-hidden px-4 py-16">
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Aircraft", path: "/aircraft" },
        ])}
      />
      <SectionLinks links={AIRCRAFT_PAGES} current="/aircraft" />
      <PageIntro
        kicker="Aircraft"
        title="Helicopter and flight cockpits, built in the same workshop."
        lead="Racing is the live catalogue. Aircraft is workshop capacity we have already named in public — rotary first — then assembled on the Gold Coast. No invented type ratings or SKUs. Book the studio or enquire."
      />
      <div className="mt-10">
        <ToolCards
          links={[
            { to: "/aircraft/helicopter", label: "Helicopter", hint: "Rotary trainers for rehearsal and procedure work." },
            { to: "/aircraft/flight", label: "Fixed-wing", hint: "Flight decks and jet trainers, same assembly line." },
            { to: "/studio", label: "Studio", hint: "Sit the layout before we crate it." },
            { to: "/contact", label: "Enquire", hint: "Tell us airframe, motion, visuals and room." },
            { to: "/training", label: "Training programs", hint: "Aviation training sits under Training as well." },
          ]}
        />
      </div>
      <p className="mt-10 max-w-2xl text-sm text-muted">
        Capacity is consult-first. We do not list a public parts shop for aircraft — the racing checker does not apply here.
      </p>
      <Link to="/contact" className="es-btn mt-6 inline-flex">
        Talk to the workshop
      </Link>
    </div>
  );
}
