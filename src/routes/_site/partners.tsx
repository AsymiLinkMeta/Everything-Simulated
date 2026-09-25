import { createFileRoute } from "@tanstack/react-router";
import { JsonLd } from "@/components/es/bits";
import { PageHero, PhoneStrip } from "@/components/es/section-page";
import { PARTNER_GROUPS } from "@/lib/es/platforms";
import { breadcrumbLd, pageHead } from "@/lib/es/seo";

export const Route = createFileRoute("/_site/partners")({
  head: () =>
    pageHead({
      title: "Hardware & Industry Partners | Everything Simulated",
      description:
        "The hardware brands, event partners and industry collaborators behind Everything Simulated — Simagic, Trak Racer, Exodus, SIMRIG, Dynamix, Player1, Circolo and Adrenalin Events.",
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
        title="Hardware & Industry Partners"
        lead="The brands we install, the venues we partner with and the industry names behind our builds. Every listing represents an active working relationship."
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
        <PhoneStrip title="Become a Partner" lead="We work with hardware manufacturers, venues, racing teams and training providers. Get in touch via the enquiry form." />
      </div>
    </div>
  );
}
