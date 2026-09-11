import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { JsonLd, Money } from "@/components/es/bits";
import { PageIntro, ToolCards } from "@/components/es/section-page";
import { pageHead, breadcrumbLd, itemListLd } from "@/lib/es/seo";
import { RACING_TOOLS } from "@/lib/es/platforms";
import { fetchFeaturedPrebuilds, livePackages } from "@/lib/es/prebuilds";
import { PACKAGES } from "@/lib/es/catalog";

export const Route = createFileRoute("/_site/racing")({
  head: () =>
    pageHead({
      title: "Racing simulators | Everything Simulated Gold Coast",
      description:
        "Turn-key racing simulators, parts shop and compatibility checker. Gold Coast assembled, crate freight Australia-wide.",
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
    <div className="mx-auto w-full min-w-0 max-w-6xl overflow-x-hidden px-4 py-16">
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
      <PageIntro
        kicker="Racing"
        title="The racing line — shop, checker, crates."
        lead="Everything Simulated’s live product is racing. Prebuilds, parts, the compatibility engine and the customer app all sit here. Aircraft, drones and training are separate platforms."
      />

      <section className="mt-12">
        <h2 className="text-2xl font-medium">Tools</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Same workshop rules as always. The checker is law. Chat only explains it.
        </p>
        <div className="mt-6">
          <ToolCards links={RACING_TOOLS} />
        </div>
      </section>

      <section className="mt-16">
        <div className="mb-8 flex items-end justify-between gap-4">
          <h2 className="text-2xl font-medium">Prebuilt crates</h2>
          <Link to="/prebuilds" className="text-sm text-muted hover:text-paper">
            All prebuilds <ArrowRight className="inline size-4" />
          </Link>
        </div>
        <div className="es-pack-grid">
          {packs.slice(0, 3).map((p) => (
            <Link key={p.slug} to="/prebuilds/$slug" params={{ slug: p.slug }} className="group block">
              <div className="relative aspect-square overflow-hidden rounded-2xl border border-line bg-black">
                {p.image ? (
                  <img src={p.image} alt={p.name} className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
                ) : null}
              </div>
              <h3 className="mt-4 text-xl font-medium">{p.name}</h3>
              <p className="mt-2 text-sm text-muted">{p.blurb}</p>
              <p className="mt-3">
                <Money cents={p.price} gst />
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
