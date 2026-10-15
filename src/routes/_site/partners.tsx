import { STAGE_IMAGES } from "@/lib/es/stage-images";
import { createFileRoute } from "@tanstack/react-router";
import { JsonLd, LoadError } from "@/components/es/bits";
import { PageHero, PhoneStrip } from "@/components/es/section-page";
import { PARTNER_GROUPS } from "@/lib/es/platforms";
import { breadcrumbLd, pageHead } from "@/lib/es/seo";
import { useQuery } from "@tanstack/react-query";
import { fetchBrands } from "@/lib/es/brands";

export const Route = createFileRoute("/_site/partners")({
  head: () =>
    pageHead({
      title: "Hardware & Industry Partners | Everything Simulated",
      description:
        "The hardware brands, event partners and industry collaborators behind Everything Simulated.",
      path: "/partners",
    }),
  component: PartnersPage,
});

function PartnersPage() {
  const brands = useQuery({ queryKey: ["brands"], queryFn: () => fetchBrands() });
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
        image={STAGE_IMAGES["/partners"]}
        tone="race"
      />
      <div className="es-body">
        <section className="mb-12">
          <p className="es-kicker es-kicker-telemetry">Hardware</p>
          {brands.isPending ? (
            <ul className="es-tile-grid is-3 mt-6" aria-busy="true" aria-label="Loading brands">
              {[0, 1, 2].map((i) => (
                <li key={i} className="es-tile h-28 animate-pulse bg-raised" />
              ))}
            </ul>
          ) : brands.isError ? (
            <div className="mt-6">
              <LoadError what="the brand list" onRetry={() => void brands.refetch()} />
            </div>
          ) : (brands.data ?? []).length === 0 ? (
            <p className="mt-6 text-sm text-muted">Brand partners will be listed here soon.</p>
          ) : (
            <ul className="es-tile-grid is-3 mt-6">
              {(brands.data ?? []).map((b) => (
                <li key={b.id} className="es-tile">
                  <div className="es-tile-copy">
                    <p className="es-kicker">Hardware</p>
                    <h3>{b.name}</h3>
                    {b.link_url ? (
                      <p>
                        <a href={b.link_url} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">
                          {b.link_url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                        </a>
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
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
