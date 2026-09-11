import { createFileRoute, Link } from "@tanstack/react-router";
import { JsonLd } from "@/components/es/bits";
import { PageIntro, ToolCards } from "@/components/es/section-page";
import { breadcrumbLd, pageHead } from "@/lib/es/seo";

export const Route = createFileRoute("/_site/drones")({
  head: () =>
    pageHead({
      title: "Drone simulators | Everything Simulated Gold Coast",
      description:
        "FPV and ground-station drone simulators assembled on the Gold Coast. Studio consult for commercial and recreational trainers.",
      path: "/drones",
    }),
  component: DronesPage,
});

function DronesPage() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl overflow-x-hidden px-4 py-16">
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Drones", path: "/drones" },
        ])}
      />
      <PageIntro
        kicker="Drones"
        title="Drone simulators."
        lead="Ground-station and FPV trainers for operators who need rehearsal without putting a airframe in the air. Specced with you, assembled here."
      />
      <div className="mt-10">
        <ToolCards
          links={[
            { to: "/studio", label: "Studio", hint: "See a control layout before we build." },
            { to: "/training", label: "Training", hint: "Programs that run on drone simulators." },
            { to: "/contact", label: "Enquire", hint: "Tell us RePL rehearsal, FPV or commercial ops." },
            { to: "/aircraft", label: "Aircraft", hint: "Manned aviation sits next door." },
          ]}
        />
      </div>
      <p className="mt-10 max-w-2xl text-sm text-muted">
        We are not a CASA RTO on this site. If you need a licence course, we will say so and point you at the right partner — we build the simulator.
      </p>
    </div>
  );
}
