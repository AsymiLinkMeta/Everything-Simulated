import { createFileRoute, Link } from "@tanstack/react-router";
import { JsonLd } from "@/components/es/bits";
import { PageHero } from "@/components/es/section-page";
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
        <div className="grid gap-12 md:grid-cols-3">
          {PARTNER_GROUPS.map((g) => (
            <section key={g.title}>
              <p className="es-kicker es-kicker-telemetry">{g.title}</p>
              <ul className="mt-5 space-y-px bg-line">
                {g.items.map((p) => (
                  <li key={p.name} className="bg-panel px-4 py-4">
                    <p className="font-medium">{p.name}</p>
                    <p className="mt-1 text-sm text-muted">{p.role}</p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <p className="mt-12 max-w-2xl text-sm text-muted">
          Want to be listed? Hardware, venues, teams and training partners go through the staff inbox — not a public form farm.
        </p>
        <Link to="/contact" className="es-btn mt-6 inline-flex">
          Talk to the workshop
        </Link>
      </div>
    </div>
  );
}
