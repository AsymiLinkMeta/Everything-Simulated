import { createFileRoute, Link } from "@tanstack/react-router";
import { JsonLd } from "@/components/es/bits";
import { ImageCards, PageHero, PhoneStrip, SectionLinks } from "@/components/es/section-page";
import { AIRCRAFT_PAGES } from "@/lib/es/platforms";
import { breadcrumbLd, pageHead } from "@/lib/es/seo";

export const Route = createFileRoute("/_site/aircraft/helicopter")({
  head: () =>
    pageHead({
      title: "Helicopter Simulators Australia | Training & Rehearsal | Everything Simulated",
      description:
        "Custom helicopter cockpit simulators with collective, cyclic and anti-torque controls. Specced to your training requirements and assembled on the Gold Coast.",
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
        title="Helicopter Simulators"
        lead="Collective, cyclic and anti-torque control layouts for training and procedure rehearsal — specced to your requirements and assembled on the Gold Coast."
        image="/rigs/showroom.jpg"
        tone="adventure"
      >
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link to="/studio" className="es-btn">Book the studio</Link>
          <Link to="/contact" className="es-btn es-btn-paper">Enquire</Link>
        </div>
      </PageHero>
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
        <div className="mt-12">
          <ImageCards
            columns={2}
            cards={[
              { to: "/aircraft/flight", image: "/rigs/motion.jpg", kicker: "Fixed-wing", title: "Flight", hint: "Same floor, different controls." },
              { to: "/studio", image: "/rigs/haptic.jpg", kicker: "Studio", title: "Sit the layout", hint: "Consult before the crate." },
            ]}
          />
        </div>
        <PhoneStrip title="Book a Studio Consultation" lead="Every helicopter build starts with a consultation to define your requirements." />
      </div>
    </div>
  );
}
