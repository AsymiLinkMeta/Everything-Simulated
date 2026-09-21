import { createFileRoute, Link } from "@tanstack/react-router";
import { JsonLd } from "@/components/es/bits";
import { CtaStrip, ImageCards, PageHero } from "@/components/es/section-page";
import { breadcrumbLd, pageHead } from "@/lib/es/seo";

export const Route = createFileRoute("/_site/drones")({
  head: () =>
    pageHead({
      title: "Drone simulators | Everything Simulated Gold Coast",
      description:
        "FPV and ground-station drone simulators assembled on the Gold Coast. Studio consult for commercial and recreational trainers — capacity, not a fake shop.",
      path: "/drones",
    }),
  component: DronesPage,
});

function DronesPage() {
  return (
    <div>
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Drones", path: "/drones" },
        ])}
      />
      <PageHero
        kicker="Drones · workshop platform"
        title="Rehearsal without the airframe."
        lead="Ground-station and FPV trainers for operators who need hours on the sticks first. Named as workshop capacity — specced with you, assembled here."
        image="/rigs/motion.jpg"
        tone="adventure"
      />
      <div className="es-body">
        <ImageCards
          columns={2}
          cards={[
            { to: "/studio", image: "/rigs/showroom.jpg", kicker: "Studio", title: "See the layout", hint: "Control layout before we build." },
            { to: "/training", image: "/rigs/starter.jpg", kicker: "Training", title: "Hours on the sticks", hint: "Programs that run on drone simulators." },
            { to: "/aircraft", image: "/rigs/haptic.jpg", kicker: "Aircraft", title: "Manned next door", hint: "Helicopter and fixed-wing sit on the same floor." },
            { to: "/contact", image: "/rigs/motion.jpg", kicker: "Enquire", title: "RePL, FPV or ops", hint: "Tell us the brief. We are not a CASA RTO." },
          ]}
        />
        <CtaStrip title="We build the simulator." lead="Licence courses sit with the right partner. If you need a ticket, we will say so.">
          <Link to="/contact" className="es-btn">Enquire</Link>
        </CtaStrip>
      </div>
    </div>
  );
}
