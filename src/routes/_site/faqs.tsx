import { createFileRoute, Link } from "@tanstack/react-router";
import { BRAND, GUIDES } from "@/lib/es/catalog";
import { livePackages } from "@/lib/es/prebuilds";
import { FAQS, faqLd, graphLd, organizationLd, pageHead } from "@/lib/es/seo";
import { JsonLd, Money } from "@/components/es/bits";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/es/section-page";

export const Route = createFileRoute("/_site/faqs")({
  head: () =>
    pageHead({
      title: "FAQs | Everything Simulated racing simulators",
      description: "Answers on pricing, motion vs haptic, compatibility, delivery and warranty for Gold Coast assembled racing simulators.",
      path: "/faqs",
    }),
  component: FAQs,
});

function FAQs() {
  return (
    <div>
      <JsonLd data={graphLd(organizationLd(), faqLd(FAQS))} />
      <PageHero
        kicker="Questions"
        title="Asked before the deposit."
        lead="Pricing, motion vs haptic, compatibility, delivery and warranty — the same answers we give on the workshop floor."
        image="/rigs/haptic.jpg"
      />
      <div className="es-body mx-auto max-w-3xl">
        <ol className="es-rail">
          {FAQS.map((f, i) => (
            <li key={f.q} className="es-rail-step">
              <strong>{String(i + 1).padStart(2, "0")} {f.q}</strong>
              <span>{f.a}</span>
            </li>
          ))}
        </ol>
        <p className="mt-8 text-sm text-muted">From <Money cents={livePackages()[0]?.priceExGst ?? 0} gst /> assembled. Call {BRAND.phone}.</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild><Link to="/prebuilds">Configure a build</Link></Button>
          <Button variant="outline" asChild><Link to="/contact">Talk to the workshop</Link></Button>
        </div>
        <section className="mt-16">
          <p className="es-kicker es-kicker-telemetry">Learn more</p>
          <h2 className="es-display mt-2 text-4xl">Guides</h2>
          <div className="es-guide-grid mt-6">
            {GUIDES.map((g) => (
              <Link key={g.slug} to="/guides/$slug" params={{ slug: g.slug }} className="es-card p-5">
                <h3 className="m-0">{g.title}</h3>
                <p className="mt-2 text-sm text-muted">{g.description}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
