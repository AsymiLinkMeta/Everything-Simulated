import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/es/catalog";
import { pageHead, serviceLd } from "@/lib/es/seo";
import { JsonLd } from "@/components/es/bits";
import { PageHero } from "@/components/es/section-page";

export const Route = createFileRoute("/_site/studio")({
  head: () =>
    pageHead({
      title: "Gold Coast sim racing showroom | Try before you buy",
      description:
        "Book a Gold Coast studio session with Taylah. Sit racing crates, or consult on aircraft, drone and training layouts before we assemble.",
      path: "/studio",
    }),
  component: Studio,
});

function Studio() {
  return (
    <div>
      <JsonLd data={serviceLd()} />
      <PageHero
        kicker="Showroom · try before you buy"
        title="Sit in the rig before it ships."
        lead={`The workshop is on the Gold Coast. Book Starter, Haptic or Motion. Ask for ${BRAND.contactName} — we set wheel height, pedal spacing and the coaching screen on the chassis you are buying.`}
        image="/rigs/showroom.jpg"
        tone="race"
      >
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild>
            <Link to="/app/book">Book a demo</Link>
          </Button>
          <Button variant="outline" asChild>
            <a href={`tel:${BRAND.phone.replace(/\s/g, "")}`}>Call {BRAND.contactName}</a>
          </Button>
        </div>
      </PageHero>
      <div className="es-body grid gap-12 md:grid-cols-[1fr_1.1fr]">
        <div>
          <p className="es-kicker es-kicker-telemetry">Process</p>
          <h2 className="es-display mt-2 text-4xl">Four steps to a crate.</h2>
          <p className="mt-4 text-sm text-muted">
            {BRAND.region} · {BRAND.phone} · {BRAND.email}
          </p>
        </div>
        <ol className="es-rail">
          <li className="es-rail-step">
            <strong>01 Book or call</strong>
            <span>Weekday and Saturday slots. {BRAND.contactName} on {BRAND.phone}.</span>
          </li>
          <li className="es-rail-step">
            <strong>02 Sit the chassis</strong>
            <span>Starter, Haptic or Motion — triples plus an aux screen on the upper two.</span>
          </li>
          <li className="es-rail-step">
            <strong>03 Set the driver</strong>
            <span>Pedal spacing and wheel height on the frame that will crate. Juniors welcome with a parent — torque stays at 12Nm unless a coach asks otherwise.</span>
          </li>
          <li className="es-rail-step">
            <strong>04 Save the quote</strong>
            <span>Already own triples or a PC? Bring photos. We strip those lines. The build job starts from the customer app.</span>
          </li>
        </ol>
      </div>
    </div>
  );
}
