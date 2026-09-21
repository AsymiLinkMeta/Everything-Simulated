import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { JsonLd, Money } from "@/components/es/bits";
import { CtaStrip, ImageCards, PageHero } from "@/components/es/section-page";
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

const TOOL_IMAGES: Record<string, string> = {
  "/prebuilds": "/rigs/haptic.jpg",
  "/shop": "/rigs/starter.jpg",
  "/compatibility": "/rigs/motion.jpg",
  "/app/build": "/rigs/haptic.jpg",
  "/app/chat": "/rigs/starter.jpg",
  "/studio": "/rigs/showroom.jpg",
  "/guides": "/rigs/starter.jpg",
  "/faqs": "/rigs/motion.jpg",
};

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
        <p className="es-kicker es-kicker-telemetry">Grid</p>
        <h2 className="es-display mt-2 text-5xl">Prebuilt crates</h2>
        <div className="es-pack-grid mt-8">
          {packs.slice(0, 3).map((p) => (
            <Link key={p.slug} to="/prebuilds/$slug" params={{ slug: p.slug }} className="es-pack-tile">
              <div className="es-pack-tile-frame">
                {p.image ? <img src={p.image} alt={p.name} /> : null}
              </div>
              <div className="es-pack-tile-meta">
                <p className="es-kicker">{p.kicker}</p>
                <h3>{p.name}</h3>
                <p className="mt-2 text-sm text-muted">{p.blurb}</p>
                <p className="mt-3">
                  <Money cents={p.price} gst />
                </p>
              </div>
            </Link>
          ))}
        </div>

        <p className="es-kicker es-kicker-telemetry mt-16">Garage</p>
        <h2 className="es-display mt-2 text-5xl">Tools</h2>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          The checker is law. Chat only explains it. Try-before-you-buy is a phone call to Taylah.
        </p>
        <div className="mt-8">
          <ImageCards
            cards={RACING_TOOLS.slice(0, 6).map((t) => ({
              to: t.to,
              image: TOOL_IMAGES[t.to] || "/rigs/haptic.jpg",
              kicker: t.label,
              title: t.label,
              hint: t.hint,
            }))}
          />
        </div>
        <CtaStrip title="Sit it on the Coast." lead="Pedal spacing and wheel height are set on the chassis you are buying.">
          <Link to="/studio" className="es-btn">Book a demo</Link>
          <Link to="/prebuilds" className="es-btn es-btn-paper">All prebuilds</Link>
        </CtaStrip>
      </div>
    </div>
  );
}
