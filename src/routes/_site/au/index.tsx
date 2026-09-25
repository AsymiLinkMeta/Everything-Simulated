import { createFileRoute } from "@tanstack/react-router";
import { CITIES } from "@/lib/es/catalog";
import { itemListLd, pageHead } from "@/lib/es/seo";
import { JsonLd } from "@/components/es/bits";
import { ImageCards, PageHero, PhoneStrip } from "@/components/es/section-page";

export const Route = createFileRoute("/_site/au/")({
  head: () =>
    pageHead({
      title: "Racing Simulators Delivered Australia-Wide | Everything Simulated",
      description: "Gold Coast assembled racing simulators delivered to Sydney, Melbourne, Brisbane, Perth, Adelaide, Canberra, Hobart, Darwin and the Sunshine Coast. Professional crate freight with optional white-glove installation.",
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
        title="Australia-Wide Simulator Delivery"
        lead="One workshop. Every capital city. Professional crate freight with optional white-glove installation."
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
        <PhoneStrip title="Delivery & Installation" lead="South-East Queensland installation is included. Capital cities are scheduled. Regional areas are quoted individually." />
      </div>
    </div>
  );
}
