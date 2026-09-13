import { createFileRoute, Link } from "@tanstack/react-router";
import { JsonLd } from "@/components/es/bits";
import { PageHero, SectionLinks } from "@/components/es/section-page";
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
    <div>
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Aircraft", path: "/aircraft" },
          { name: "Helicopter", path: "/aircraft/helicopter" },
        ])}
      />
      <PageHero
        kicker="Rotary"
        title="Helicopter simulators."
        lead="Collective, cyclic and anti-torque layouts for training and rehearsal — specced with you, assembled on the Gold Coast."
        image="/rigs/showroom.jpg"
        tone="adventure"
      />
      <div className="es-body">
        <SectionLinks links={AIRCRAFT_PAGES} current="/aircraft/helicopter" tone="adventure" />
        <ul className="es-rail mt-10 max-w-2xl">
          <li className="es-rail-step">
            <strong>Rehearsal, not a school</strong>
            <span>Training and procedure work. We are not a public type-rating shop.</span>
          </li>
          <li className="es-rail-step">
            <strong>Quoted, not guessed</strong>
            <span>Room, payload and motion are a consult. Chat does not invent a spec.</span>
          </li>
          <li className="es-rail-step">
            <strong>Same crate path</strong>
            <span>Workshop photos, then Australia-wide freight — same discipline as racing.</span>
          </li>
        </ul>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/studio" className="es-btn">
            Book the studio
          </Link>
          <Link to="/contact" className="es-btn es-btn-paper">
            Enquire
          </Link>
        </div>
      </div>
    </div>
  );
}
