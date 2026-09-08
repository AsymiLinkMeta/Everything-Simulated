import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { BRAND, GUIDES, PACKAGES } from "@/lib/es/catalog";
import { FAQS, faqLd, pageHead } from "@/lib/es/seo";
import { JsonLd, Money } from "@/components/es/bits";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_site/faqs")({
  head: () =>
    pageHead({
      title: "FAQs | Everything Simulated racing simulators",
      description:
        "Answers on pricing, motion vs haptic, compatibility, delivery and warranty for Gold Coast assembled racing simulators.",
      path: "/faqs",
    }),
  component: FAQs,
});

function FAQs() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <JsonLd data={faqLd(FAQS)} />
      <p className="es-kicker">Questions</p>
      <h1 className="mt-3 text-4xl font-medium">Frequently asked questions</h1>
      <p className="mt-4 text-muted">
        Everything we get asked about turn-key sim racing rigs — pricing, motion vs haptic,
        compatibility, delivery and warranty.
      </p>
      <ul className="mt-10 space-y-4">
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
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button asChild>
          <Link to="/builds">Configure a build</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/contact">Talk to the workshop</Link>
        </Button>
      </div>
      <section className="mt-16">
        <p className="es-kicker">Learn more</p>
        <h2 className="mt-2 text-2xl font-medium">Guides</h2>
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
    </div>
  );
}
