import { createFileRoute } from "@tanstack/react-router";
import { GUIDES } from "@/lib/es/catalog";
import { itemListLd, pageHead } from "@/lib/es/seo";
import { JsonLd } from "@/components/es/bits";
import { ImageCards, PageHero } from "@/components/es/section-page";

export const Route = createFileRoute("/_site/guides/")({
  head: () =>
    pageHead({
      title: "Sim racing buying guides Australia | Everything Simulated",
      description: "How much a racing simulator costs in Australia, motion vs haptic, Simagic ecosystem, junior setups, triples vs ultrawide, and Australia-wide delivery.",
      path: "/guides",
    }),
  component: Guides,
});

const GUIDE_IMAGES = ["/rigs/starter.jpg", "/rigs/haptic.jpg", "/rigs/motion.jpg", "/rigs/showroom.jpg"];

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
      <div className="es-body">
        <ImageCards
          cards={GUIDES.map((g, i) => ({
            to: `/guides/${g.slug}`,
            image: GUIDE_IMAGES[i % GUIDE_IMAGES.length],
            kicker: String(i + 1).padStart(2, "0"),
            title: g.title,
            hint: g.description,
          }))}
        />
      </div>
    </div>
  );
}
