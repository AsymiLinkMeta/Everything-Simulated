import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { JsonLd, Money } from "@/components/es/bits";
import { PageHero, ToolCards } from "@/components/es/section-page";
import { pageHead, breadcrumbLd, itemListLd } from "@/lib/es/seo";
import { RACING_TOOLS } from "@/lib/es/platforms";
import { fetchFeaturedPrebuilds, livePackages } from "@/lib/es/prebuilds";
import { PACKAGES } from "@/lib/es/catalog";

export const Route = createFileRoute("/_site/racing")({
  head: () =>
    pageHead({
      title: "Racing simulators | Everything Simulated Gold Coast",
      description:
        "Turn-key racing simulators with motion, haptic and triple-plus-aux screens. Simagic, Trak Racer, Exodus and Dynamix. Gold Coast assembled, crate freight Australia-wide.",
      path: "/racing",
    }),
  component: RacingHub,
});

function RacingHub() {
  const featured = useQuery({ queryKey: ["featured-prebuilds"], queryFn: fetchFeaturedPrebuilds });
  const packs = featured.data?.length
    ? featured.data.map((p) => ({ slug: p.slug, name: p.name, blurb: p.blurb, image: p.image, price: p.price_ex_gst, kicker: p.kicker }))
    : (livePackages().length ? livePackages() : PACKAGES).map((p) => ({
        slug: p.slug,
        name: p.name,
        blurb: p.blurb,
        image: p.image,
        price: p.priceExGst,
        kicker: p.kicker,
      }));

  return (
    <div>
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Racing", path: "/racing" },
        ])}
      />
      <JsonLd
        data={itemListLd(
          "Racing simulator tools",
          "/racing",
          RACING_TOOLS.map((t) => ({ name: t.label, path: t.to })),
        )}
      />
      <PageHero
        kicker="Racing · live catalogue"
        title="The line that already ships."
        lead="Motion, haptic, triples plus an aux screen. Prebuilds, parts and the compatibility engine all sit here. Sit the chassis on the Gold Coast before it crates."
        image="/rigs/motion.jpg"
        tone="race"
      />

      <div className="es-body">
        <section>
          <p className="es-kicker es-kicker-telemetry">Garage</p>
          <h2 className="es-display mt-2 text-4xl">Tools</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            The checker is law. Chat only explains it. Try-before-you-buy is a phone call to Taylah.
          </p>
          <div className="mt-8">
            <ToolCards links={RACING_TOOLS} tone="race" />
          </div>
        </section>

        <section className="mt-20">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <p className="es-kicker es-kicker-telemetry">Grid</p>
              <h2 className="es-display mt-2 text-4xl">Prebuilt crates</h2>
            </div>
            <Link to="/prebuilds" className="text-sm tracking-wide text-muted hover:text-paper">
              All prebuilds <ArrowRight className="inline size-4" />
            </Link>
          </div>
          <div className="es-pack-grid">
            {packs.slice(0, 3).map((p) => (
              <Link key={p.slug} to="/prebuilds/$slug" params={{ slug: p.slug }} className="es-pack-tile">
                <div className="es-pack-tile-frame">
                  {p.image ? <img src={p.image} alt={p.name} /> : null}
                </div>
                <div className="es-pack-tile-meta">
                  <h3>{p.name}</h3>
                  <p className="mt-2 text-sm text-muted">{p.blurb}</p>
                  <p className="mt-3">
                    <Money cents={p.price} gst />
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
