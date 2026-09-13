import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/es/seo";
import { PageHero } from "@/components/es/section-page";

export const Route = createFileRoute("/_site/terms")({
  head: () =>
    pageHead({
      title: "Terms | Everything Simulated",
      description: "Quotes, deposits, lead times and Australia-wide freight terms for Everything Simulated.",
      path: "/terms",
    }),
  component: Terms,
});

function Terms() {
  return (
    <article>
      <PageHero kicker="Legal" title="Terms." lead="Quotes, deposits, lead times and crate freight." image="/rigs/starter.jpg" />
      <div className="es-body mx-auto max-w-2xl text-sm leading-relaxed text-muted">
        <p>Prices are AUD exclusive of GST unless marked otherwise. A quote is not an order. Builds start on deposit. Lead times are estimates from the longest indent part in the cart. Freight is quoted per crate and destination. Compatibility of mixed third-party parts not in this catalogue is not warranted. Australian Consumer Law rights are not excluded.</p>
      </div>
    </article>
  );
}
