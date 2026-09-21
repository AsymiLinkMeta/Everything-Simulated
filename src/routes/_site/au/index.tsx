import { createFileRoute } from "@tanstack/react-router";
import { CITIES } from "@/lib/es/catalog";
import { itemListLd, pageHead } from "@/lib/es/seo";
import { JsonLd } from "@/components/es/bits";
import { ImageCards, PageHero } from "@/components/es/section-page";

export const Route = createFileRoute("/_site/au/")({
  head: () =>
    pageHead({
      title: "Racing simulators delivered Australia-wide | Everything Simulated",
      description: "Gold Coast built sim racing rigs crate-freighted to Sydney, Melbourne, Brisbane, Perth, Adelaide, Canberra, Hobart, Darwin and the Sunshine Coast.",
      path: "/au",
    }),
  component: Australia,
});

function Australia() {
  return (
    <div>
      <JsonLd data={itemListLd("Racing simulators delivered Australia-wide", "/au", CITIES.map((c) => ({ name: `Sim racing ${c.name}`, path: `/au/${c.slug}` })))} />
      <PageHero
        kicker="Coverage"
        title="Australia-wide from the Gold Coast."
        lead="One workshop. Capital-city crates. Optional white-glove install."
        image="/rigs/showroom.jpg"
      />
      <div className="es-body">
        <ImageCards
          cards={CITIES.map((c) => ({
            to: `/au/${c.slug}`,
            image: c.slug === "gold-coast" ? "/rigs/showroom.jpg" : "/rigs/haptic.jpg",
            kicker: c.state,
            title: c.name,
            hint: c.note,
          }))}
        />
      </div>
    </div>
  );
}
