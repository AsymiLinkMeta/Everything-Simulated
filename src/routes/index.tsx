import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, MapPin } from "lucide-react";
import { SiteShell } from "@/components/es/site-shell";
import { JsonLd, Money, PackageCard } from "@/components/es/bits";
import { BRAND, CITIES, GUIDES, PACKAGES } from "@/lib/es/catalog";
import { FAQS, faqLd, localBusinessLd, pageHead } from "@/lib/es/seo";

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
      <JsonLd data={faqLd(FAQS)} />
      <section className="es-hero">
        <img src="/rigs/Everything_Simulated_Hero.jpg" alt="Driver using a triple-screen racing simulator" className="es-hero-img" />
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
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-3">
          {[
            {
              title: "Workshop, not a warehouse",
              body: "Every rig is assembled, cable-managed and photographed on the Gold Coast before the crate is sealed.",
            },
            {
              title: "Checker before deposit",
              body: "Torque, payload, QR and mounts are rules — not opinions. The AI expert explains the JSON. It does not invent SKUs.",
            },
            {
              title: "Australia-wide crate freight",
              body: "SEQ install is standard. Capital-city white-glove is scheduled. Regional is quoted. Warranty is handled in Australia.",
            },
          ].map((b) => (
            <div key={b.title}>
              <h3 className="text-lg font-medium">{b.title}</h3>
              <p className="mt-2 text-sm text-muted">{b.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <p className="es-kicker">Brands we spec</p>
        <p className="mt-3 max-w-2xl text-muted">
          Simagic · Trak Racer · Exodus (SIMRIGS AU) · SIMRIG · AOC · Logitech · iRacing
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="es-card es-split" style={{ overflow: "hidden" }}>
          <img src="/rigs/showroom.jpg" alt="Gold Coast showroom" className="h-72 w-full object-cover md:h-full" />
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

      <section className="mx-auto max-w-6xl px-4 py-8">
        <h2 className="text-2xl font-medium">Guides</h2>
        <div className="es-guide-grid" style={{ marginTop: 24 }}>
          {GUIDES.map((g) => (
            <Link key={g.slug} to="/guides/$slug" params={{ slug: g.slug }} className="es-card" style={{ padding: 20 }}>
              <h3 style={{ margin: 0 }}>{g.title}</h3>
              <p className="text-muted" style={{ marginTop: 8, fontSize: 14 }}>
                {g.description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16">
        <h2 className="text-2xl font-medium">Questions</h2>
        <ul className="mt-6 space-y-4">
          {FAQS.map((f) => (
            <li key={f.q} className="es-card" style={{ padding: 20 }}>
              <p className="flex gap-2 font-medium">
                <Check className="mt-1 size-4 shrink-0 text-esred" />
                {f.q}
              </p>
              <p className="mt-2 text-sm text-muted">{f.a}</p>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-sm text-muted">
          From <Money cents={PACKAGES[0].priceExGst} gst /> assembled. Call {BRAND.phone}.
        </p>
      </section>
    </SiteShell>
  );
}
