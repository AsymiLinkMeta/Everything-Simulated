import { createFileRoute, Link } from "@tanstack/react-router";
import { JsonLd } from "@/components/es/bits";
import { PageHero, ToolCards } from "@/components/es/section-page";
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
        <ToolCards
          tone="adventure"
          links={[
            { to: "/studio", label: "Studio", hint: "See a control layout before we build." },
            { to: "/training", label: "Training", hint: "Programs that run on drone simulators." },
            { to: "/contact", label: "Enquire", hint: "Tell us RePL rehearsal, FPV or commercial ops." },
            { to: "/aircraft", label: "Aircraft", hint: "Manned aviation sits next door." },
          ]}
        />
        <p className="mt-10 max-w-2xl text-sm text-muted">
          We are not a CASA RTO on this site. If you need a licence course, we will say so and point you at the right partner — we build the simulator.
        </p>
        <Link to="/contact" className="es-btn mt-6 inline-flex">
          Enquire
        </Link>
      </div>
    </div>
  );
}
