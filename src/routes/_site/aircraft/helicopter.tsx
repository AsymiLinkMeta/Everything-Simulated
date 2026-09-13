import { createFileRoute, Link } from "@tanstack/react-router";
import { JsonLd } from "@/components/es/bits";
import { PageIntro, SectionLinks } from "@/components/es/section-page";
import { AIRCRAFT_PAGES } from "@/lib/es/platforms";
import { breadcrumbLd, pageHead } from "@/lib/es/seo";

export const Route = createFileRoute("/_site/aircraft/helicopter")({
  head: () =>
    pageHead({
      title: "Helicopter simulators | Everything Simulated Gold Coast",
      description:
        "Helicopter cockpit simulators specced and assembled on the Gold Coast. Studio consult for training and rehearsal builds.",
      path: "/aircraft/helicopter",
    }),
  component: HelicopterPage,
});

function HelicopterPage() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl overflow-x-hidden px-4 py-16">
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Aircraft", path: "/aircraft" },
          { name: "Helicopter", path: "/aircraft/helicopter" },
        ])}
      />
      <SectionLinks links={AIRCRAFT_PAGES} current="/aircraft/helicopter" />
      <PageIntro
        kicker="Rotary"
        title="Helicopter simulators."
        lead="The rotary cockpit is the aircraft platform we have already put our name on. Collective, cyclic and anti-torque layouts for training and rehearsal — specced with you, assembled on the Gold Coast."
      />
      <ul className="mt-10 max-w-2xl space-y-3 text-sm text-muted">
        <li>Training and procedure rehearsal — not a public type-rating school.</li>
        <li>Room, payload and motion are quoted, not guessed in chat.</li>
        <li>Same crate-freight path as racing: workshop photos, then Australia-wide.</li>
      </ul>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/studio" className="es-btn">
          Book the studio
        </Link>
        <Link to="/contact" className="es-btn es-btn-paper">
          Enquire
        </Link>
      </div>
    </div>
  );
}
