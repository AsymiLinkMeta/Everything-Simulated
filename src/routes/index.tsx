import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SiteShell } from "@/components/es/site-shell";
import { JsonLd, Money } from "@/components/es/bits";
import { BRAND, CITIES } from "@/lib/es/catalog";
import { graphLd, localBusinessLd, organizationLd, pageHead, websiteLd, faqLd, FAQS } from "@/lib/es/seo";
import { fetchBrands } from "@/lib/es/brands";
import { fetchFeaturedPrebuilds, livePackages } from "@/lib/es/prebuilds";
import { PACKAGES } from "@/lib/es/catalog";
import { PLATFORMS } from "@/lib/es/platforms";

export const Route = createFileRoute("/")({
  head: () =>
    pageHead({
      title: "Everything Simulated | Gold Coast simulator workshop — racing, aircraft, drones, training",
      description:
        "Gold Coast workshop for racing, aircraft, drone and training simulators. Racing crates ship with a compatibility checker. Other platforms are specced in studio. Australia-wide freight.",
      path: "/",
    }),
  component: Home,
});

export function Home() {
  const racing = PLATFORMS.find((p) => p.slug === "racing");
  const rest = PLATFORMS.filter((p) => p.slug !== "racing");

  return (
    <SiteShell>
      <JsonLd data={graphLd(organizationLd(), websiteLd(), localBusinessLd(), faqLd(FAQS))} />
      <section className="es-hero">
        <img src="/rigs/Everything_Simulated_Hero copy.jpg" alt="Driver using a triple-screen racing simulator" className="es-hero-img" />
        <HeroVideo />
        <div className="es-hero-mask" />
        <div className="es-hero-copy">
          <div className="es-lights" aria-hidden="true">
            <i /><i /><i /><i /><i />
          </div>
          <p className="es-kicker es-kicker-telemetry">Gold Coast · Try before you buy · Australia-wide</p>
          <h1>One workshop. Every machine.</h1>
          <p className="lead">
            Racing crates already ship — motion, haptic, triples and an aux screen.
            Aircraft, drones and training are specced on the same Gold Coast floor.
            Sit the chassis before it leaves.
          </p>
          <div className="es-hero-actions">
            <Link to="/racing" className="es-btn">
              Enter the garage <ArrowRight className="size-4" />
            </Link>
            <Link to="/studio" className="es-btn es-btn-paper">
              Book a studio demo
            </Link>
          </div>
        </div>
      </section>

      {racing ? (
        <Link to={racing.to} className="es-chapter">
          <img src={racing.image} alt="" />
          <div className="es-chapter-veil" />
          <div className="es-chapter-copy">
            <span className="es-chapter-idx">01</span>
            <p className="es-kicker es-kicker-telemetry">{racing.kicker}</p>
            <h2>{racing.name}</h2>
            <p>{racing.blurb}</p>
          </div>
        </Link>
      ) : null}

      <div className="es-chapter-row">
        {rest.map((platform, i) => (
          <Link key={platform.slug} to={platform.to} className="es-chapter">
            <img src={platform.image} alt="" />
            <div className="es-chapter-veil" />
            <div className="es-chapter-copy">
              <span className="es-chapter-idx">{String(i + 2).padStart(2, "0")}</span>
              <p className="es-kicker es-kicker-telemetry">{platform.kicker}</p>
              <h2>{platform.name}</h2>
              <p>{platform.blurb}</p>
            </div>
          </Link>
        ))}
      </div>

      <FeaturedPrebuilds />

      <section className="es-body grid gap-12 md:grid-cols-[1fr_1.2fr]">
        <div>
          <p className="es-kicker es-kicker-telemetry">The build</p>
          <h2 className="es-display mt-2 text-5xl">From first spec to a crate on the floor.</h2>
        </div>
        <ol className="es-rail">
          <li className="es-rail-step">
            <strong>01 Design the crate</strong>
            <span>Walk the same steps the workshop uses. Only parts we actually bolt on.</span>
          </li>
          <li className="es-rail-step">
            <strong>02 Run the checker</strong>
            <span>Torque, payload, QR and mounts. Chat cannot override a block.</span>
          </li>
          <li className="es-rail-step">
            <strong>03 Sit it on the Coast</strong>
            <span>Book Taylah. Pedal spacing and wheel height are set before it ships.</span>
          </li>
          <li className="es-rail-step">
            <strong>04 Keep the build</strong>
            <span>Quotes, upgrades and care live in the customer app after the crate leaves.</span>
          </li>
        </ol>
      </section>

      <BrandBanner />

      <Link to="/studio" className="es-chapter">
        <img src="/rigs/Everything_Simulated_Hero.jpg" alt="Driver using a racing simulator" />
        <div className="es-chapter-veil" />
        <div className="es-chapter-copy">
          <p className="es-kicker es-kicker-telemetry">Studio</p>
          <h2>Try before the crate leaves</h2>
          <p>
            Book a session with {BRAND.contactName} at the {BRAND.region} workshop.
            Pedal spacing, wheel height and the coaching screen are set on the chassis you are buying.
          </p>
        </div>
      </Link>

      <section className="es-body">
        <div className="mb-8 flex items-center gap-2">
          <MapPin className="size-4 text-esred" />
          <h2 className="es-display text-4xl">Delivered Australia-wide</h2>
        </div>
        <div className="es-city-grid">
          {CITIES.map((c) => (
            <Link key={c.slug} to="/au/$city" params={{ city: c.slug }} className="es-card es-city-card">
              {c.name} <span>{c.state}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="es-body pt-0">
        <p className="es-kicker es-kicker-telemetry">FAQ</p>
        <h2 className="es-display mt-2 text-4xl">Asked before the deposit</h2>
        <dl className="mt-8 grid gap-6 md:grid-cols-2">
          {FAQS.slice(0, 4).map((item) => (
            <div key={item.q} className="es-card p-5">
              <dt className="font-medium">{item.q}</dt>
              <dd className="mt-2 text-sm text-muted">{item.a}</dd>
            </div>
          ))}
        </dl>
        <Link to="/faqs" className="mt-6 inline-flex items-center gap-1 text-sm text-paper underline-offset-4 hover:underline">
          All FAQs <ArrowRight className="size-4" />
        </Link>
      </section>
    </SiteShell>
  );
}

function FeaturedPrebuilds() {
  const featured = useQuery({ queryKey: ["featured-prebuilds"], queryFn: fetchFeaturedPrebuilds });
  const items = featured.data ?? [];
  const hasDynamic = items.length > 0;

  return (
    <section className="es-body">
      <div className="mb-10 flex items-end justify-between gap-4">
        <div>
          <p className="es-kicker es-kicker-telemetry">Racing · live catalogue</p>
          <h2 className="es-display mt-2 text-5xl">Prebuilt racing crates</h2>
        </div>
        <Link to="/shop" className="hidden text-sm text-muted hover:text-paper md:inline">
          Or spec from parts
        </Link>
      </div>
      {hasDynamic ? (
        <div className="es-pack-grid">
          {items.map((p) => (
            <div key={p.id} className="group">
              <Link
                to="/prebuilds/$slug"
                params={{ slug: p.slug }}
                className="es-pack-tile"
              >
                <div className="es-pack-tile-frame">
                  {p.image ? <img src={p.image} alt={p.name} /> : <div className="grid size-full place-items-center bg-raised text-muted">No image</div>}
                </div>
              </Link>
              <div className="es-pack-tile-meta">
                <h3 className="text-paper">{p.name}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{p.blurb}</p>
                <p className="mt-4 text-lg font-medium text-paper">
                  <Money cents={p.price_ex_gst} gst />
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="es-pack-grid">
          {(livePackages().length ? livePackages() : PACKAGES).map((p) => (
            <div key={p.slug} className="group">
              <Link to="/prebuilds/$slug" params={{ slug: p.slug }} className="es-pack-tile">
                <div className="es-pack-tile-frame">
                  <img src={p.image} alt={p.name} />
                </div>
              </Link>
              <div className="es-pack-tile-meta">
                <h3 className="text-paper">{p.name}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{p.blurb}</p>
                <p className="mt-4 text-lg font-medium text-paper">
                  <Money cents={p.priceExGst} gst />
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function HeroVideo() {
  const desktopRef = useRef<HTMLVideoElement>(null);
  const mobileRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<"playing" | "black" | "revealed">("playing");

  useEffect(() => {
    const desktop = desktopRef.current;
    const mobile = mobileRef.current;
    const video = window.matchMedia("(max-width: 767px)").matches ? mobile : desktop;
    if (!video) return;
    const onEnded = () => {
      setPhase("black");
      window.setTimeout(() => setPhase("revealed"), 1100);
    };
    video.addEventListener("ended", onEnded);
    video.play().catch(() => setPhase("revealed"));
    return () => video.removeEventListener("ended", onEnded);
  }, []);

  return (
    <>
      <div className={`es-hero-video-wrap${phase === "revealed" ? " is-finished" : ""}`}>
        <video ref={desktopRef} className="es-hero-video es-hero-video-desktop" muted playsInline preload="auto" poster="/rigs/Everything_Simulated_Hero copy.jpg">
          <source src="/videos/hero-uw.mp4" type="video/mp4" />
        </video>
        <video ref={mobileRef} className="es-hero-video es-hero-video-mobile" muted playsInline preload="auto" poster="/rigs/Everything_Simulated_Hero copy.jpg">
          <source src="/videos/hero-mobile.mp4" type="video/mp4" />
        </video>
      </div>
      <div className={`es-hero-blackout${phase !== "playing" ? " is-visible" : ""}${phase === "revealed" ? " is-fading" : ""}`} />
    </>
  );
}

function BrandLogo({
  brand,
  ariaHidden = false,
}: {
  brand: { id: string; name: string; icon_url: string | null; link_url: string | null };
  ariaHidden?: boolean;
}) {
  const content = brand.icon_url ? (
    <img src={brand.icon_url} alt={ariaHidden ? "" : brand.name} className="h-full w-full object-contain" />
  ) : (
    <span className="text-base font-medium text-paper">{brand.name}</span>
  );
  const className = "group flex h-44 w-44 shrink-0 items-center justify-center rounded-xl border border-line bg-gloss p-6 transition-all duration-300 hover:border-esred hover:shadow-red-glow sm:h-52 sm:w-52";
  if (!brand.link_url) return <div className={className}>{content}</div>;
  return (
    <a href={brand.link_url} target="_blank" rel="noopener noreferrer" className={className} aria-hidden={ariaHidden} tabIndex={ariaHidden ? -1 : 0}>
      {content}
    </a>
  );
}

function BrandBanner() {
  const brands = useQuery({ queryKey: ["brands"], queryFn: () => fetchBrands() });
  const items = brands.data ?? [];
  return (
    <section className="border-y border-line bg-panel">
      <div className="mx-auto w-full min-w-0 max-w-6xl overflow-x-hidden px-4 py-16">
        <p className="es-kicker es-kicker-telemetry">Brands we spec</p>
        <h2 className="es-display mt-2 text-4xl">Trusted hardware, assembled right</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Simagic, Trak Racer, Exodus, SIMRIG and Dynamix on the racing line. Player1 from January 2026.
          Every crate is compatibility-checked, assembled and QA'd on the Gold Coast.
        </p>
        <div className="es-brand-marquee mt-8" aria-label="Brands we spec">
          <div className="es-brand-track">
            {Array.from({ length: 3 }, (_, setIndex) =>
              (items.length > 0 ? items : ["Simagic", "Trak Racer", "Exodus", "SIMRIG", "AOC", "Logitech", "iRacing"].map((name) => ({ id: name, name, icon_url: null, link_url: null }))).map((brand, index) => (
                <BrandLogo key={`${brand.id}-${setIndex}-${index}`} brand={brand} ariaHidden={setIndex > 0} />
              )),
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
