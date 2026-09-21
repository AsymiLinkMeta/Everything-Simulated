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

      <section className="es-body">
        <p className="es-kicker">Capacity · planned venue</p>
        <h2 className="es-display mt-2 text-4xl">A warehouse floor behind the studio.</h2>
        <p className="mt-4 max-w-2xl text-sm text-muted">
          The owner intention is a lease of about 200 square metres: warehousing on the floor,
          the build studio out the back, corporate events on the same site, and catering when a
          booking needs it. That is planned capacity — not a live street address and not a hire
          catalogue. When the lease is real, this page gets the address. Until then, enquire.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <article className="es-card p-5">
            <p className="es-kicker">Floor</p>
            <p className="mt-2 font-medium">Warehousing</p>
            <p className="mt-1 text-sm text-muted">Incoming chassis, outgoing crates. Not open browse.</p>
          </article>
          <article className="es-card p-5">
            <p className="es-kicker">Back</p>
            <p className="mt-2 font-medium">Build studio</p>
            <p className="mt-1 text-sm text-muted">Assembly, fitment, try-before-you-buy on the same site.</p>
          </article>
          <article className="es-card p-5">
            <p className="es-kicker">Events</p>
            <p className="mt-2 font-medium">Corporate + catering</p>
            <p className="mt-1 text-sm text-muted">On-site food when a booking needs it. Ask first — no public hire list.</p>
          </article>
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/contact">Enquire about the venue</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/app/book">Book a current studio slot</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
