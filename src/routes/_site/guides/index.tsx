import { createFileRoute, Link } from "@tanstack/react-router";
import { GUIDES } from "@/lib/es/catalog";
import { pageHead } from "@/lib/es/seo";

export const Route = createFileRoute("/_site/guides/")({
  head: () =>
    pageHead({
      title: "Sim racing buying guides Australia | Everything Simulated",
      description:
        "How much a racing simulator costs in Australia, motion vs haptic, Simagic ecosystem, junior setups, triples vs ultrawide, and Australia-wide delivery.",
      path: "/guides",
    }),
  component: Guides,
});

function Guides() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <p className="es-kicker">Editorial</p>
      <h1 className="mt-3 text-4xl font-medium">Guides from the workshop</h1>
      <p className="mt-4 text-muted">
        Written against the builds we actually crate — not affiliate parts lists.
      </p>
      <ul className="mt-10 space-y-4">
        {GUIDES.map((g) => (
          <li key={g.slug}>
            <Link to="/guides/$slug" params={{ slug: g.slug }} className="es-card block p-5 hover:bg-raised">
              <h2 className="text-lg font-medium">{g.title}</h2>
              <p className="mt-2 text-sm text-muted">{g.description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
