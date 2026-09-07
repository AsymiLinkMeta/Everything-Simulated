import { createFileRoute, Link } from "@tanstack/react-router";
import { CITIES } from "@/lib/es/catalog";
import { pageHead } from "@/lib/es/seo";

export const Route = createFileRoute("/_site/au/")({
  head: () =>
    pageHead({
      title: "Racing simulators delivered Australia-wide | Everything Simulated",
      description:
        "Gold Coast built sim racing rigs crate-freighted to Sydney, Melbourne, Brisbane, Perth, Adelaide, Canberra, Hobart, Darwin and the Sunshine Coast.",
      path: "/au",
    }),
  component: Australia,
});

function Australia() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <p className="es-kicker">Coverage</p>
      <h1 className="mt-3 text-4xl font-medium">Australia-wide from the Gold Coast</h1>
      <p className="mt-4 max-w-2xl text-muted">
        One workshop. Capital-city crates. Optional white-glove install. Choose your city for local
        delivery notes and the same three packages.
      </p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CITIES.map((c) => (
          <Link key={c.slug} to="/au/$city" params={{ city: c.slug }} className="es-card p-5 hover:bg-raised">
            <p className="text-xs uppercase tracking-widest text-muted">{c.state}</p>
            <h2 className="mt-1 text-xl font-medium">{c.name}</h2>
            <p className="mt-2 text-sm text-muted">{c.note}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
