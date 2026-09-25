import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { JsonLd, Money } from "@/components/es/bits";
import { ImageCards, MediaSplit, PageHero, PhoneStrip } from "@/components/es/section-page";
import { pageHead, breadcrumbLd, itemListLd } from "@/lib/es/seo";
import { RACING_TOOLS } from "@/lib/es/platforms";
import { fetchFeaturedPrebuilds, livePackages } from "@/lib/es/prebuilds";
import { PACKAGES } from "@/lib/es/catalog";

export const Route = createFileRoute("/_site/racing")({
  head: () =>
    pageHead({
      title: "Turn-Key Racing Simulators Australia | Motion, Haptic & Triple Screen | Everything Simulated",
      description:
        "Gold Coast assembled turn-key racing simulators with motion, haptic feedback and triple-plus-auxiliary screens. Simagic, Trak Racer, Exodus and Dynamix — compatibility checked and shipped Australia-wide.",
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
        title="Turn-Key Racing Simulators"
        lead="Motion platforms, haptic feedback, triple screens and an auxiliary display — fully assembled on the Gold Coast. Browse prebuilt packages, individual components or run the compatibility checker before you commit."
        image="/rigs/motion.jpg"
        tone="race"
      >
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link to="/prebuilds" className="es-btn">Sit a crate</Link>
          <Link to="/shop" className="es-btn es-btn-paper">Parts shop</Link>
        </div>
      </PageHero>

      <div className="es-body">
        <p className="es-kicker es-kicker-telemetry">Grid</p>
        <h2 className="es-display mt-2 text-5xl">Prebuilt Packages</h2>
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
      </div>

      <section className="es-body pt-0">
        <MediaSplit
          image="/rigs/haptic.jpg"
          kicker="Featured"
          title="Haptic Racing Simulator"
          lead="Our most popular build. Exodus XR1 chassis, Simagic Alpha 15Nm wheelbase, hydraulic P1000 pedals, four screens."
        >
          <Link to="/prebuilds/haptic" className="es-btn">Order this crate</Link>
        </MediaSplit>
      </section>

      <div className="es-body pt-0">
        <p className="es-kicker es-kicker-telemetry">Garage</p>
        <h2 className="es-display mt-2 text-5xl">Build & Configure Tools</h2>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          The compatibility checker enforces every rule. Use the tools below to configure your build, browse parts or book the showroom.
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
        <PhoneStrip title="Visit the Gold Coast Showroom" lead="Every build can be test-driven before dispatch. Pedal spacing and wheel height are fitted to your position." />
      </div>
    </div>
  );
}
