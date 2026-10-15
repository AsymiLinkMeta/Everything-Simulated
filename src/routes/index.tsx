import { STAGE_IMAGES } from "@/lib/es/stage-images";
import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteImage, PrebuildPhoto } from "@/components/es/site-image";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SiteShell } from "@/components/es/site-shell";
import { JsonLd, LoadError, Money } from "@/components/es/bits";
import { BRAND, CITIES } from "@/lib/es/catalog";
import { graphLd, localBusinessLd, organizationLd, pageHead, websiteLd, faqLd, FAQS } from "@/lib/es/seo";
import { fetchBrands } from "@/lib/es/brands";
import { fetchFeaturedPrebuilds } from "@/lib/es/prebuilds";
import { PLATFORMS } from "@/lib/es/platforms";
import { useLiveCopy } from "@/lib/es/live-copy";

export const Route = createFileRoute("/")({
  head: () =>
    pageHead({
      title: "Everything Simulated | Gold Coast Racing & Flight Simulator Workshop",
      description:
        "Australia's dedicated simulator workshop on the Gold Coast. Turn-key racing, aircraft, drone and training simulators — assembled, tested and shipped nationwide with a compatibility guarantee.",
      path: "/",
    }),
  component: Home,
});

export function Home() {
  const { fill } = useLiveCopy();
  const faqs = FAQS.map((f) => ({ q: f.q, a: fill(f.a) }));
  const racing = PLATFORMS.find((p) => p.slug === "racing");
  const rest = PLATFORMS.filter((p) => p.slug !== "racing");

  return (
    <SiteShell>
      <JsonLd data={graphLd(organizationLd(), websiteLd(), localBusinessLd(), faqLd(faqs))} />
      <section className="es-hero">
        <SiteImage src={STAGE_IMAGES["/"]} alt="Driver using a triple-screen racing simulator" className="es-hero-img" priority width={1948} height={908} />
        <HeroVideo />
        <div className="es-hero-mask" />
        <div className="es-hero-copy">
          <div className="es-lights" aria-hidden="true">
            <i /><i /><i /><i /><i />
          </div>
          <p className="es-kicker es-kicker-telemetry">Gold Coast · Try before you buy · Australia-wide</p>
          <h1>Australia's Turn-Key Simulator Workshop</h1>
          <p className="lead">
            Racing simulators ship now — motion, haptic, triple screens and an auxiliary display.
            Aircraft, drone and training platforms are specced on the same Gold Coast floor.
            Every build is assembled, tested and photographed before it leaves.
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
          <SiteImage src={racing.image} sizes="(min-width: 1024px) 50vw, 100vw" />
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
            <SiteImage src={platform.image} sizes="(min-width: 1024px) 33vw, 100vw" />
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
          <h2 className="es-display mt-2 text-5xl">How We Build Your Simulator</h2>
        </div>
        <ol className="es-rail">
          <li className="es-rail-step">
            <strong>01 Configure your build</strong>
            <span>Select from the same components our technicians use. Every part is compatibility-verified.</span>
          </li>
          <li className="es-rail-step">
            <strong>02 Compatibility check</strong>
            <span>Torque limits, payload ratings, quick-release and mount clearances — verified automatically.</span>
          </li>
          <li className="es-rail-step">
            <strong>03 Try before you buy</strong>
            <span>Book the Gold Coast showroom. Pedal spacing and wheel height are set to your driving position.</span>
          </li>
          <li className="es-rail-step">
            <strong>04 Ongoing support</strong>
            <span>Quotes, upgrades and service history remain in your account after delivery.</span>
          </li>
        </ol>
      </section>

      <BrandBanner />

      <Link to="/studio" className="es-chapter">
        <SiteImage src="/rigs/Everything_Simulated_Hero.jpg" alt="Driver using a racing simulator" />
        <div className="es-chapter-veil" />
        <div className="es-chapter-copy">
          <p className="es-kicker es-kicker-telemetry">Studio</p>
          <h2>Visit the Gold Coast Showroom</h2>
          <p>
            Book a hands-on session at the {BRAND.region} workshop.
            Pedal spacing, wheel height and coaching displays are fitted to your driving position before dispatch.
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
        <h2 className="es-display mt-2 text-4xl">Frequently Asked Questions</h2>
        <dl className="mt-8 grid gap-6 md:grid-cols-2">
          {faqs.slice(0, 4).map((item) => (
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

  return (
    <section className="es-body">
      <div className="mb-10 flex items-end justify-between gap-4">
        <div>
          <p className="es-kicker es-kicker-telemetry">Racing · live catalogue</p>
          <h2 className="es-display mt-2 text-5xl">Prebuilt Racing Simulators</h2>
        </div>
        <Link to="/shop" className="hidden text-sm text-muted hover:text-paper md:inline">
          Or spec from parts
        </Link>
      </div>
      {featured.isPending ? (
        <div className="es-pack-grid" role="status" aria-busy="true" aria-label="Loading prebuilds">
          {[0, 1, 2].map((i) => (
            <div key={i} className="aspect-square animate-pulse rounded-xl bg-raised" />
          ))}
        </div>
      ) : featured.isError ? (
        <LoadError what="the prebuilds" onRetry={() => void featured.refetch()} />
      ) : items.length === 0 ? (
        <p className="text-muted">
          No prebuilds are listed right now. <Link to="/shop" className="text-paper underline">Spec a rig from parts</Link> or{" "}
          <Link to="/contact" className="text-paper underline">talk to the workshop</Link>.
        </p>
      ) : (
        <div className="es-pack-grid">
          {items.map((p) => (
            <div key={p.id} className="group">
              <Link to="/prebuilds/$slug" params={{ slug: p.slug }} className="es-pack-tile" aria-label={p.name}>
                <div className="es-pack-tile-frame">
                  <PrebuildPhoto
                    prebuild={p}
                    alt={p.name}
                    sizes="(min-width: 1024px) 33vw, 100vw"
                    placeholder={<div className="grid size-full place-items-center bg-raised text-muted">No image</div>}
                  />
                </div>
              </Link>
              <div className="es-pack-tile-meta">
                <h3 className="text-paper">{p.name}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{p.blurb}</p>
                <p className="mt-4 text-lg font-medium text-paper">
                  {p.purchasable ? <>{p.price_source === "parts" ? "From " : ""}<Money cents={p.effective_price_ex_gst} gst /></> : "Enquire for price"}
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
    // Respect reduced-motion: show the poster frame, skip the intro.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("revealed");
      return;
    }
    const desktop = desktopRef.current;
    const mobile = mobileRef.current;
    const video = window.matchMedia("(max-width: 767px)").matches ? mobile : desktop;
    if (!video) return;
    let timer = 0;
    const onEnded = () => {
      setPhase("black");
      timer = window.setTimeout(() => setPhase("revealed"), 1100);
    };
    // Skip the intro on data-saver or slow connections: the poster is the hero.
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (conn?.saveData || /(^|-)2g|3g/.test(conn?.effectiveType ?? "")) {
      setPhase("revealed");
      return;
    }
    video.addEventListener("ended", onEnded);
    // Both videos are preload="none"; only the one for this viewport is fetched, and only
    // once the page has loaded so it never competes with the hero image, fonts or app code.
    let cancelled = false;
    const start = () => {
      if (cancelled) return;
      video.preload = "auto";
      video.play().catch(() => setPhase("revealed"));
    };
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const idle = () => (ric ? ric(start, { timeout: 1500 }) : window.setTimeout(start, 200));
    if (document.readyState === "complete") idle();
    else window.addEventListener("load", idle, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener("load", idle);
      video.removeEventListener("ended", onEnded);
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <>
      <div className={`es-hero-video-wrap${phase === "revealed" ? " is-finished" : ""}`}>
        <video ref={desktopRef} className="es-hero-video es-hero-video-desktop" muted playsInline preload="none" aria-hidden="true">
          <source src="/videos/hero-uw.mp4" type="video/mp4" />
        </video>
        <video ref={mobileRef} className="es-hero-video es-hero-video-mobile" muted playsInline preload="none" aria-hidden="true">
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
    <img src={brand.icon_url} alt={ariaHidden ? "" : brand.name} className="h-full w-full object-contain" loading="lazy" decoding="async" />
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

function listNames(names: string[]) {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function BrandBanner() {
  // Logos are fetched when the strip is about to scroll into view, not on first paint.
  const ref = useRef<HTMLElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    if (!("IntersectionObserver" in window)) return setNear(true);
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  const brands = useQuery({ queryKey: ["brands"], queryFn: () => fetchBrands(), enabled: near });
  const items = brands.data ?? [];
  return (
    <section ref={ref} className="border-y border-line bg-panel">
      <div className="mx-auto w-full min-w-0 max-w-6xl overflow-x-hidden px-4 py-16">
        <p className="es-kicker es-kicker-telemetry">Brands we spec</p>
        <h2 className="es-display mt-2 text-4xl">Premium Hardware, Professionally Assembled</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          {items.length > 0 ? `${listNames(items.map((b) => b.name))} on the racing line. ` : ""}
          Every simulator is compatibility-checked, assembled and quality-tested on the Gold Coast.
        </p>
        <div className="es-brand-marquee mt-8" role="region" aria-label="Brands we spec">
          <div className="es-brand-track">
            {Array.from({ length: 3 }, (_, setIndex) =>
              items.map((brand, index) => (
                <BrandLogo key={`${brand.id}-${setIndex}-${index}`} brand={brand} ariaHidden={setIndex > 0} />
              )),
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
