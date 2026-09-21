import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { JsonLd } from "@/components/es/bits";
import { PageHero } from "@/components/es/section-page";
import { BRAND } from "@/lib/es/catalog";
import { VENUE, VENUE_FLOOR, VENUE_OFFERS } from "@/lib/es/events";
import { breadcrumbLd, pageHead } from "@/lib/es/seo";

export const Route = createFileRoute("/_site/events")({
  head: () =>
    pageHead({
      title: "Events & catering | Corporate and group driver training | Everything Simulated",
      description:
        "Corporate events, on-site catering, and group training for professional and amateur drivers at the planned Gold Coast warehouse. Enquire — not a hire catalogue.",
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
        title="The warehouse floor, when a group needs it."
        lead={`Corporate days, professional and amateur driver groups, and catering on the same Gold Coast site as the build studio. Planned venue of ${VENUE.size} — ${VENUE.status}. Call ${BRAND.contactName} to enquire.`}
        image="/rigs/showroom.jpg"
        tone="race"
      >
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild>
            <Link to="/contact">Enquire about a date</Link>
          </Button>
          <Button variant="outline" asChild>
            <a href={`tel:${BRAND.phone.replace(/\s/g, "")}`}>Call {BRAND.contactName}</a>
          </Button>
        </div>
      </PageHero>

      <div className="es-body">
        <p className="es-kicker">What we host</p>
        <h2 className="es-display mt-2 text-4xl">Company days and driver groups.</h2>
        <p className="mt-4 max-w-2xl text-sm text-muted">
          Handled at the warehouse once the lease is live. Until then this is capacity language —
          we take the brief, hold the date if we can, and do not publish a calendar or a street.
        </p>
        <div className="mt-8 grid gap-3 md:grid-cols-2">
          {VENUE_OFFERS.map((offer) => (
            <article key={offer.slug} className="es-card p-5">
              <p className="es-kicker">{offer.kicker}</p>
              <h3 className="mt-2 text-xl">{offer.title}</h3>
              <p className="mt-2 text-sm text-muted">{offer.blurb}</p>
            </article>
          ))}
        </div>
      </div>

      <section className="es-body">
        <p className="es-kicker">Capacity · planned venue</p>
        <h2 className="es-display mt-2 text-4xl">Same site as the studio.</h2>
        <p className="mt-4 max-w-2xl text-sm text-muted">
          A lease of {VENUE.size}: warehousing on the floor, the build studio out the back,
          events and group training on that floor, catering when a booking needs it. {VENUE.note}
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {VENUE_FLOOR.map((bay) => (
            <article key={bay.title} className="es-card p-5">
              <p className="es-kicker">{bay.kicker}</p>
              <p className="mt-2 font-medium">{bay.title}</p>
              <p className="mt-1 text-sm text-muted">{bay.blurb}</p>
            </article>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/contact">Enquire</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/studio">Current studio demo</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/training">Training programs</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
