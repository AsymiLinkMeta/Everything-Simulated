import { createFileRoute, Link } from "@tanstack/react-router";
import { JsonLd } from "@/components/es/bits";
import { PageIntro } from "@/components/es/section-page";
import { PARTNER_GROUPS } from "@/lib/es/platforms";
import { breadcrumbLd, pageHead } from "@/lib/es/seo";

export const Route = createFileRoute("/_site/partners")({
  head: () =>
    pageHead({
      title: "Partners and industry | Everything Simulated",
      description:
        "Hardware, events and industry partners for Everything Simulated — Simagic, Trak Racer, Exodus, SIMRIG and event hire.",
      path: "/partners",
    }),
  component: PartnersPage,
});

function PartnersPage() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl overflow-x-hidden px-4 py-16">
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Partners", path: "/partners" },
        ])}
      />
      <PageIntro
        kicker="Industry"
        title="Partners."
        lead="Hardware we bolt on, events we hire to, and industry connections around the workshop. Only names we actually work with."
      />
      <div className="mt-12 grid gap-10 md:grid-cols-3">
        {PARTNER_GROUPS.map((g) => (
          <section key={g.title}>
            <h2 className="text-xl font-medium">{g.title}</h2>
            <ul className="mt-4 space-y-3">
              {g.items.map((p) => (
                <li key={p.name} className="es-card p-4">
                  <p className="font-medium">{p.name}</p>
                  <p className="mt-1 text-sm text-muted">{p.role}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="mt-10 max-w-2xl text-sm text-muted">
        Want to be listed? Hardware, venues, teams and training partners go through the staff inbox — not a public form farm.
      </p>
      <Link to="/contact" className="es-btn mt-6 inline-flex">
        Talk to the workshop
      </Link>
    </div>
  );
}
