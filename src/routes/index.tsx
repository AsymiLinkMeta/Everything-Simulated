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

export const Route = createFileRoute("/")({
  head: () =>
    pageHead({
      title: "Everything Simulated | Gold Coast racing simulators, Australia-wide",
      description:
        "Turn-key sim racing rigs built on the Gold Coast. Simagic, Trak Racer, Exodus, SIMRIG. Compatibility checked before deposit. Delivered Australia-wide.",
      path: "/",
    }),
  component: Home,
});

export function Home() {
  return (
    <SiteShell>
      <JsonLd data={graphLd(organizationLd(), websiteLd(), localBusinessLd(), faqLd(FAQS))} />
      <section className="es-hero">
        <img src="/rigs/Everything_Simulated_Hero copy.jpg" alt="Driver using a triple-screen racing simulator" className="es-hero-img" />
        <HeroVideo />
        <div className="es-hero-mask" />
        <div className="es-hero-copy">
          <p className="es-kicker">Gold Coast · Australia-wide</p>
          <h1>Turn Your Racing Dreams Into Reality.</h1>
          <p className="lead">
            Assembled and QA’d in our Gold Coast workshop. Compatibility checked before deposit.
            Crate freight to every capital city.
          </p>
          <div className="es-hero-actions">
            <Link to="/prebuilds" className="es-btn">
              View prebuilds <ArrowRight className="size-4" />
            </Link>
            <Link to="/studio" className="es-btn es-btn-paper">
              Book a studio demo
            </Link>
          </div>
        </div>
      </section>

      <FeaturedPrebuilds />

      <section className="border-y border-line bg-panel">
        <div className="mx-auto w-full min-w-0 max-w-6xl overflow-x-hidden px-4 py-20 es-roadmap-section">
          <div className="max-w-2xl">
            <p className="es-kicker">Your rig, your roadmap</p>
            <h2 className="mt-3 text-3xl font-medium sm:text-4xl">
              Create an account to design, upgrade or maintain your rig.
            </h2>
            <p className="mt-4 text-muted">
              Keep every decision in one place, from the first compatible build to future upgrades,
              saved quotes and ongoing care.
            </p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: "Design your build",
                body: "Configure a complete rig with the parts we actually assemble and ship.",
                image: "/rigs/starter.jpg",
                to: "/app/build",
              },
              {
                title: "Check compatibility",
                body: "Validate torque, payload, QR and mount choices before you commit.",
                image: "/rigs/haptic.jpg",
                to: "/compatibility",
              },
              {
                title: "Upgrade with confidence",
                body: "Save your current setup, compare options and request a tailored quote.",
                image: "/rigs/motion.jpg",
                to: "/app/quotes",
              },
              {
                title: "Maintain over time",
                body: "Keep your build history close and get help when your rig evolves.",
                image: "/rigs/showroom.jpg",
                to: "/app/chat",
              },
            ].map((feature) => (
              <Link
                key={feature.title}
                to={feature.to}
                className="group overflow-hidden rounded-2xl border border-line bg-black transition-transform duration-300 hover:-translate-y-1"
              >
                <div className="aspect-[4/3] overflow-hidden">
                  <img
                    src={feature.image}
                    alt=""
                    className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-medium text-paper">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">{feature.body}</p>
                  <span className="mt-5 inline-block text-sm text-paper underline-offset-4 group-hover:underline">
                    Explore tool
                  </span>
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link to="/login" className="es-btn">
              Create your account <ArrowRight className="size-4" />
            </Link>
            <Link to="/login" className="text-sm text-muted underline-offset-4 hover:text-paper hover:underline">
              Already have an account? Sign in
            </Link>
          </div>
        </div>
      </section>

      <BrandBanner />

      <section className="mx-auto w-full min-w-0 max-w-6xl overflow-x-hidden px-4 py-8">
        <div className="es-card es-split" style={{ overflow: "hidden" }}>
          <img src="/rigs/Everything_Simulated_Hero.jpg" alt="Driver using a racing simulator" className="h-72 w-full object-cover md:h-full" />
          <div className="flex flex-col justify-center gap-4 p-8">
            <p className="es-kicker">Studio</p>
            <h2 className="text-2xl font-medium">Try before the crate leaves</h2>
            <p className="text-sm text-muted">
              Book a session at the {BRAND.region} workshop. We set pedal spacing and wheel height on the actual chassis.
            </p>
            <Link to="/studio" className="es-btn" style={{ width: "fit-content" }}>
              Book the studio
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full min-w-0 max-w-6xl overflow-x-hidden px-4 py-16">
        <div className="mb-8 flex items-center gap-2">
          <MapPin className="size-4 text-esred" />
          <h2 className="text-2xl font-medium">Delivered Australia-wide</h2>
        </div>
        <div className="es-city-grid">
          {CITIES.map((c) => (
            <Link key={c.slug} to="/au/$city" params={{ city: c.slug }} className="es-card es-city-card">
              {c.name} <span>{c.state}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full min-w-0 max-w-6xl overflow-x-hidden px-4 pb-20">
        <p className="es-kicker">FAQ</p>
        <h2 className="mt-3 text-2xl font-medium">Asked before the deposit</h2>
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
    <section className="mx-auto w-full min-w-0 max-w-6xl overflow-x-hidden px-4 py-20">
      <div className="mb-10 flex items-end justify-between gap-4">
        <div>
          <p className="es-kicker">Packages</p>
          <h2 className="mt-2 text-3xl font-medium">Prebuilt simulators</h2>
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
                className="relative block aspect-square overflow-hidden rounded-2xl border border-line bg-black transition-transform duration-300 group-hover:-translate-y-1"
              >
                {p.image ? (
                  <img
                    src={p.image}
                    alt={p.name}
                    className="absolute inset-0 size-full bg-black object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-raised text-muted">No image</div>
                )}
                {p.kicker && (
                  <span className="es-kicker absolute left-4 top-4 rounded-lg bg-black/70 px-2 py-1.5">
                    {p.kicker}
                  </span>
                )}
              </Link>
              <div className="px-1 pt-4">
                <h3 className="text-xl font-medium text-paper">{p.name}</h3>
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
              <Link
                to="/prebuilds/$slug"
                params={{ slug: p.slug }}
                className="relative block aspect-square overflow-hidden rounded-2xl border border-line bg-black transition-transform duration-300 group-hover:-translate-y-1"
              >
                <img
                  src={p.image}
                  alt={p.name}
                  className="absolute inset-0 size-full bg-black object-cover transition-transform duration-500 group-hover:scale-105"
                />
                {p.kicker ? (
                  <span className="es-kicker absolute left-4 top-4 rounded-lg bg-black/70 px-2 py-1.5">{p.kicker}</span>
                ) : null}
              </Link>
              <div className="px-1 pt-4">
                <h3 className="text-xl font-medium text-paper">{p.name}</h3>
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
        <video
          ref={desktopRef}
          className="es-hero-video es-hero-video-desktop"
          muted
          playsInline
          preload="auto"
          poster="/rigs/Everything_Simulated_Hero copy.jpg"
        >
          <source src="/videos/hero-uw.mp4" type="video/mp4" />
        </video>
        <video
          ref={mobileRef}
          className="es-hero-video es-hero-video-mobile"
          muted
          playsInline
          preload="auto"
          poster="/rigs/Everything_Simulated_Hero copy.jpg"
        >
          <source src="/videos/hero-mobile.mp4" type="video/mp4" />
        </video>
      </div>
      <div
        className={`es-hero-blackout${phase !== "playing" ? " is-visible" : ""}${phase === "revealed" ? " is-fading" : ""}`}
      />
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
  const className = "group flex h-44 w-44 shrink-0 items-center justify-center rounded-xl border border-line bg-black p-6 transition-all duration-300 hover:border-muted hover:bg-raised sm:h-52 sm:w-52";
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
        <p className="es-kicker">Brands we spec</p>
        <h2 className="mt-2 text-2xl font-medium">Trusted hardware, assembled right</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          We build with the best sim racing hardware brands. Every rig is compatibility-checked,
          assembled and QA'd in our Gold Coast workshop.
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
