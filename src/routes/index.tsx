import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, MapPin } from "lucide-react";
import { SiteShell } from "@/components/es/site-shell";
import { JsonLd, PackageCard } from "@/components/es/bits";
import { BRAND, CITIES, PACKAGES } from "@/lib/es/catalog";
import { localBusinessLd, pageHead } from "@/lib/es/seo";
import { fetchBrands } from "@/lib/es/brands";

export const Route = createFileRoute("/")({
  head: () =>
    pageHead({
      title: "Everything Simulated | Gold Coast racing simulators, Australia-wide",
      description:
        "Turn-key sim racing rigs built on the Gold Coast. Starter $11,260 + GST, Haptic $18,999 + GST, Motion $28,999 + GST. Simagic, Trak Racer, Exodus, SIMRIG. Delivered Australia-wide.",
      path: "/",
    }),
  component: Home,
});

export function Home() {
  return (
    <SiteShell>
      <JsonLd data={localBusinessLd()} />
      <section className="es-hero">
        <img src="/rigs/Everything_Simulated_Hero copy.jpg" alt="Driver using a triple-screen racing simulator" className="es-hero-img" />
        <div className="es-hero-mask" />
        <div className="es-hero-copy">
          <p className="es-kicker">Gold Coast · Australia-wide</p>
          <h1>Turn Your Racing Dreams Into Reality.</h1>
          <p className="lead">
            Assembled and QA’d in our Gold Coast workshop. Compatibility checked before deposit.
            Crate freight to every capital city.
          </p>
          <div className="es-hero-actions">
            <Link to="/builds" className="es-btn">
              Configure a build <ArrowRight className="size-4" />
            </Link>
            <Link to="/studio" className="es-btn es-btn-paper">
              Book a studio demo
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="mb-10 flex items-end justify-between gap-4">
          <div>
            <p className="es-kicker">Packages</p>
            <h2 className="mt-2 text-3xl font-medium">Three serious starting points</h2>
          </div>
          <Link to="/shop" className="hidden text-sm text-muted hover:text-paper md:inline">
            Or spec from parts
          </Link>
        </div>
        <div className="es-pack-grid">
          {PACKAGES.map((pack) => (
            <PackageCard key={pack.slug} pack={pack} />
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-panel">
        <div className="mx-auto max-w-6xl px-4 py-20">
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

      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="es-card es-split" style={{ overflow: "hidden" }}>
          <img src="/rigs/hero.jpg" alt="Driver using a racing simulator" className="h-72 w-full object-cover md:h-full" />
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

      <section className="mx-auto max-w-6xl px-4 py-16">
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

    </SiteShell>
  );
}

function BrandBanner() {
  const brands = useQuery({ queryKey: ["brands"], queryFn: () => fetchBrands() });
  const items = brands.data ?? [];
  return (
    <section className="border-y border-line bg-panel">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <p className="es-kicker">Brands we spec</p>
        <h2 className="mt-2 text-2xl font-medium">Trusted hardware, assembled right</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          We build with the best sim racing hardware brands. Every rig is compatibility-checked,
          assembled and QA'd in our Gold Coast workshop.
        </p>
        {items.length > 0 ? (
          <div className="mt-8 flex flex-wrap items-center gap-4">
            {items.map((b) =>
              b.link_url ? (
                <a
                  key={b.id}
                  href={b.link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-3 rounded-xl border border-line bg-black px-5 py-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-muted"
                >
                  {b.icon_url ? (
                    <img src={b.icon_url} alt={b.name} className="h-8 w-auto max-w-[120px] object-contain" />
                  ) : (
                    <span className="text-base font-medium text-paper">{b.name}</span>
                  )}
                </a>
              ) : (
                <div key={b.id} className="flex items-center gap-3 rounded-xl border border-line bg-black px-5 py-3">
                  {b.icon_url ? (
                    <img src={b.icon_url} alt={b.name} className="h-8 w-auto max-w-[120px] object-contain" />
                  ) : (
                    <span className="text-base font-medium text-paper">{b.name}</span>
                  )}
                </div>
              ),
            )}
          </div>
        ) : (
          <div className="mt-8 flex flex-wrap items-center gap-4">
            {["Simagic", "Trak Racer", "Exodus", "SIMRIG", "AOC", "Logitech", "iRacing"].map((name) => (
              <div key={name} className="rounded-xl border border-line bg-black px-5 py-3">
                <span className="text-base font-medium text-paper">{name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
