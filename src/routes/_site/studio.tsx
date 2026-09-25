import { createFileRoute, Link } from "@tanstack/react-router";
import { BRAND } from "@/lib/es/catalog";
import { VENUE, VENUE_FLOOR } from "@/lib/es/events";
import { pageHead, serviceLd } from "@/lib/es/seo";
import { JsonLd } from "@/components/es/bits";
import { CtaStrip, PageHero } from "@/components/es/section-page";

export const Route = createFileRoute("/_site/studio")({
  head: () =>
    pageHead({
      title: "Gold Coast Simulator Showroom | Try Before You Buy | Everything Simulated",
      description:
        "Book a hands-on demo at our Gold Coast showroom. Test racing simulators in person or consult on aircraft, drone and training builds before we assemble and ship.",
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
        title="Gold Coast Simulator Showroom"
        lead="Experience your build before it ships. Book a session on Starter, Haptic or Motion — we adjust wheel height, pedal spacing and coaching displays to your exact driving position."
        image="/rigs/showroom.jpg"
        tone="race"
      >
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link to="/app/book" className="es-btn">
            Book a demo
          </Link>
          <a href={`tel:${BRAND.phone.replace(/\s/g, "")}`} className="es-btn es-btn-paper">
            Call the workshop
          </a>
        </div>
      </PageHero>
      <div className="es-body grid gap-12 md:grid-cols-[1fr_1.1fr]">
        <div>
          <p className="es-kicker es-kicker-telemetry">Process</p>
          <h2 className="es-display mt-2 text-5xl">From Demo to Delivery</h2>
          <p className="mt-4 text-sm text-muted">
            {BRAND.region} · {BRAND.phone} · {BRAND.email}
          </p>
        </div>
        <ol className="es-rail">
          <li className="es-rail-step">
            <strong>01 Book or call</strong>
            <span>Weekday and Saturday slots. {BRAND.phone}.</span>
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

      <section className="es-page-band">
        <div className="es-body">
          <p className="es-kicker">Capacity · planned venue</p>
          <h2 className="es-display mt-2 text-5xl">Dedicated Workshop & Event Space</h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
            The owner intention is a lease of {VENUE.size}: warehousing on the floor,
            the build studio out the back, corporate events and group driver training on the same site,
            and catering when a booking needs it. That is {VENUE.status} — not a live street address and not a hire
            catalogue. When the lease is real, this page gets the address. Until then, enquire.
          </p>
          <div className="es-offer-grid is-4 mt-10">
            {VENUE_FLOOR.map((bay) => (
              <article key={bay.title}>
                <p className="es-kicker">{bay.kicker}</p>
                <p className="es-display mt-3 text-3xl">{bay.title}</p>
                <p className="mt-2 text-sm leading-6 text-muted">{bay.blurb}</p>
              </article>
            ))}
          </div>
          <CtaStrip title="Book a Showroom Session" lead="Events and catering are available by enquiry. Contact the workshop to arrange a visit.">
            <Link to="/app/book" className="es-btn">
              Book a slot
            </Link>
            <Link to="/events" className="es-btn es-btn-paper">
              Events & catering
            </Link>
          </CtaStrip>
        </div>
      </section>
    </div>
  );
}
