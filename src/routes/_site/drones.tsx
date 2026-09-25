import { createFileRoute, Link } from "@tanstack/react-router";
import { JsonLd } from "@/components/es/bits";
import { ImageCards, PageHero, PhoneStrip } from "@/components/es/section-page";
import { breadcrumbLd, pageHead } from "@/lib/es/seo";

export const Route = createFileRoute("/_site/drones")({
  head: () =>
    pageHead({
      title: "Drone & FPV Simulators Australia | Ground Station Training | Everything Simulated",
      description:
        "FPV and ground-station drone simulators assembled on the Gold Coast. Custom-built for commercial and recreational operators — specced to your mission profile and shipped Australia-wide.",
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
        title="Drone & FPV Training Simulators"
        lead="Purpose-built ground-station and FPV trainers for operators who need logged hours before flying live. Each build is specced to your mission requirements and assembled on the Gold Coast."
        image="/rigs/motion.jpg"
        tone="adventure"
      >
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link to="/contact" className="es-btn">Enquire</Link>
          <Link to="/studio" className="es-btn es-btn-paper">Studio</Link>
        </div>
      </PageHero>
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
        <PhoneStrip title="We Build the Simulator" lead="Licensing and certification courses are delivered by accredited partners. If you need a qualification, we will refer you to the right provider." />
      </div>
    </div>
  );
}
