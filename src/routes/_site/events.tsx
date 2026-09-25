import { createFileRoute, Link } from "@tanstack/react-router";
import { JsonLd } from "@/components/es/bits";
import { CtaStrip, PageHero } from "@/components/es/section-page";
import { BRAND } from "@/lib/es/catalog";
import { VENUE, VENUE_FLOOR, VENUE_OFFERS } from "@/lib/es/events";
import { breadcrumbLd, pageHead } from "@/lib/es/seo";

export const Route = createFileRoute("/_site/events")({
  head: () =>
    pageHead({
      title: "Corporate Simulator Events & Group Driver Training | Everything Simulated",
      description:
        "Host corporate team days, product launches and group driver training sessions at our Gold Coast simulator facility. Full catering available. Enquire to book a date.",
      path: "/events",
    }),
  component: EventsPage,
});

function EventsPage() {
  return (
    <div>
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Events", path: "/events" },
        ])}
      />
      <PageHero
        kicker="Events · catering · group training"
        title="Corporate Events & Group Training"
        lead={`Team-building days, professional driver groups and catered events at the Gold Coast simulator facility. Planned venue of ${VENUE.size} — ${VENUE.status}. Contact the workshop to secure a date.`}
        image="/rigs/showroom.jpg"
        tone="race"
      >
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link to="/contact" className="es-btn">
            Enquire about a date
          </Link>
          <a href={`tel:${BRAND.phone.replace(/\s/g, "")}`} className="es-btn es-btn-paper">
            Call the workshop
          </a>
        </div>
      </PageHero>

      <div className="es-body">
        <p className="es-kicker">What we host</p>
        <h2 className="es-display mt-2 text-5xl">What We Host</h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
          Handled at the warehouse once the lease is live. Until then this is capacity language —
          we take the brief, hold the date if we can, and do not publish a calendar or a street.
        </p>
        <div className="es-offer-grid is-2 mt-10">
          {VENUE_OFFERS.map((offer) => (
            <article key={offer.slug}>
              <p className="es-kicker">{offer.kicker}</p>
              <h3 className="es-display mt-3 text-3xl">{offer.title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted">{offer.blurb}</p>
            </article>
          ))}
        </div>
      </div>

      <section className="es-page-band">
        <div className="es-body">
          <p className="es-kicker">Capacity · planned venue</p>
          <h2 className="es-display mt-2 text-5xl">Integrated Venue & Workshop</h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
            A lease of {VENUE.size}: warehousing on the floor, the build studio out the back,
            events and group training on that floor, catering when a booking needs it. {VENUE.note}
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
          <CtaStrip title="Reserve Your Event Date" lead="No public hire list. Contact the workshop with your brief to discuss availability.">
            <Link to="/contact" className="es-btn">
              Enquire
            </Link>
            <Link to="/studio" className="es-btn es-btn-paper">
              Current studio demo
            </Link>
          </CtaStrip>
        </div>
      </section>
    </div>
  );
}
