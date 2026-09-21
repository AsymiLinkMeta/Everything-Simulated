import { createFileRoute, Link } from "@tanstack/react-router";
import { JsonLd } from "@/components/es/bits";
import { CtaStrip, PageHero } from "@/components/es/section-page";
import { PARTNER_GROUPS } from "@/lib/es/platforms";
import { breadcrumbLd, pageHead } from "@/lib/es/seo";

export const Route = createFileRoute("/_site/partners")({
  head: () =>
    pageHead({
      title: "Partners and industry | Everything Simulated",
      description:
        "Hardware, events and industry partners for Everything Simulated — Simagic, Trak Racer, Exodus, SIMRIG, Dynamix, Player1, Circolo and Adrenalin Events.",
      path: "/partners",
    }),
  component: PartnersPage,
});

function PartnersPage() {
  return (
    <div>
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Partners", path: "/partners" },
        ])}
      />
      <PageHero
        kicker="Industry"
        title="Partners we name in public."
        lead="Hardware we bolt on, events we hire to, and industry names already on the workshop’s socials. Only people and brands we actually work with."
        image="/rigs/starter.jpg"
        tone="race"
      />
      <div className="es-body">
        {PARTNER_GROUPS.map((g) => (
          <section key={g.title} className="mb-12 last:mb-0">
            <p className="es-kicker es-kicker-telemetry">{g.title}</p>
            <ul className="es-tile-grid is-3 mt-6">
              {g.items.map((p) => (
                <li key={p.name} className="es-tile">
                  <div className="es-tile-copy">
                    <p className="es-kicker">{g.title}</p>
                    <h3>{p.name}</h3>
                    <p>{p.role}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <CtaStrip title="Want to be listed?" lead="Hardware, venues, teams and training partners go through the staff inbox.">
          <Link to="/contact" className="es-btn">Talk to the workshop</Link>
        </CtaStrip>
      </div>
    </div>
  );
}
