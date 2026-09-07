import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/es/seo";

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
    <article className="mx-auto max-w-2xl px-4 py-16 text-sm leading-relaxed text-muted">
      <h1 className="text-3xl font-medium text-paper">Terms</h1>
      <p className="mt-6">
        Prices are AUD exclusive of GST unless marked otherwise. A quote is not an order. Builds
        start on deposit. Lead times are estimates from the longest indent part in the cart. Freight
        is quoted per crate and destination. Compatibility of mixed third-party parts not in this
        catalogue is not warranted. Australian Consumer Law rights are not excluded.
      </p>
    </article>
  );
}
