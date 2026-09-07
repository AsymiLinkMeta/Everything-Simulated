import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, MapPin } from "lucide-react";
import { SiteShell } from "@/components/es/site-shell";
import { JsonLd, Money, PackageCard } from "@/components/es/bits";
import { Button } from "@/components/ui/button";
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

function Home() {
  return (
    <SiteShell>
      <JsonLd data={localBusinessLd()} />
      <JsonLd data={faqLd(FAQS)} />
      <section className="relative isolate min-h-dvh overflow-hidden">
        <img src="/rigs/hero.jpg" alt="Everything Simulated Gold Coast racing simulator studio" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-ink/75" />
        <div className="relative mx-auto flex min-h-dvh max-w-6xl flex-col justify-end px-4 pb-16 pt-28">
          <p className="es-kicker mb-4">Gold Coast · Australia-wide</p>
          <h1 className="max-w-3xl text-4xl font-medium leading-tight tracking-tight md:text-6xl">
            Racing simulators, built properly.
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted md:text-lg">
            Assembled and QA’d in our Gold Coast workshop. Compatibility checked before deposit.
            Crate freight to every capital city.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link to="/builds">
                Configure a build <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="paper" size="lg">
              <Link to="/studio">Book a studio demo</Link>
            </Button>
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
        <div className="grid gap-6 md:grid-cols-3">
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
        <div className="es-card grid overflow-hidden md:grid-cols-2">
          <img src="/rigs/showroom.jpg" alt="Gold Coast showroom" className="h-72 w-full object-cover md:h-full" />
          <div className="flex flex-col justify-center gap-4 p-8">
            <p className="es-kicker">Studio</p>
            <h2 className="text-2xl font-medium">Try before the crate leaves</h2>
            <p className="text-sm text-muted">
              Book a session at the {BRAND.region} workshop. We set pedal spacing and wheel height on the actual chassis.
            </p>
            <Button asChild className="w-fit">
              <Link to="/studio">Book the studio</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-8 flex items-center gap-2">
          <MapPin className="size-4 text-esred" />
          <h2 className="text-2xl font-medium">Delivered Australia-wide</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {CITIES.map((c) => (
            <Link key={c.slug} to="/au/$city" params={{ city: c.slug }} className="es-card px-4 py-4 text-sm hover:bg-raised">
              {c.name}
              <span className="block text-xs text-muted">{c.state}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8">
        <h2 className="text-2xl font-medium">Guides</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {GUIDES.map((g) => (
            <Link key={g.slug} to="/guides/$slug" params={{ slug: g.slug }} className="es-card p-5 hover:bg-raised">
              <h3 className="font-medium">{g.title}</h3>
              <p className="mt-2 text-sm text-muted">{g.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16">
        <h2 className="text-2xl font-medium">Questions</h2>
        <ul className="mt-6 space-y-4">
          {FAQS.map((f) => (
            <li key={f.q} className="es-card p-5">
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
