import { createFileRoute, Link } from "@tanstack/react-router";
import { GUIDES } from "@/lib/es/catalog";
import { itemListLd, pageHead } from "@/lib/es/seo";
import { JsonLd } from "@/components/es/bits";
import { PageHero } from "@/components/es/section-page";

export const Route = createFileRoute("/_site/guides/")({
  head: () =>
    pageHead({
      title: "Sim racing buying guides Australia | Everything Simulated",
      description: "How much a racing simulator costs in Australia, motion vs haptic, Simagic ecosystem, junior setups, triples vs ultrawide, and Australia-wide delivery.",
      path: "/guides",
    }),
  component: Guides,
});

function Guides() {
  return (
    <div>
      <JsonLd data={itemListLd("Sim racing buying guides Australia", "/guides", GUIDES.map((g) => ({ name: g.title, path: `/guides/${g.slug}` })))} />
      <PageHero
        kicker="Editorial"
        title="Guides from the workshop."
        lead="Written against the builds we actually crate — not affiliate parts lists."
        image="/rigs/starter.jpg"
      />
      <div className="es-body mx-auto max-w-3xl">
        <ol className="es-rail">
          {GUIDES.map((g, i) => (
            <li key={g.slug} className="es-rail-step">
              <strong>
                <Link to="/guides/$slug" params={{ slug: g.slug }} className="text-paper">
                  {String(i + 1).padStart(2, "0")} {g.title}
                </Link>
              </strong>
              <span>{g.description}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
