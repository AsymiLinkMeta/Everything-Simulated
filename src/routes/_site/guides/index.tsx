import { createFileRoute } from "@tanstack/react-router";
import { GUIDES } from "@/lib/es/catalog";
import { itemListLd, pageHead } from "@/lib/es/seo";
import { JsonLd } from "@/components/es/bits";
import { ImageCards, PageHero, PhoneStrip } from "@/components/es/section-page";

export const Route = createFileRoute("/_site/guides/")({
  head: () =>
    pageHead({
      title: "Sim Racing Buying Guides Australia | Everything Simulated",
      description: "Expert buying guides covering racing simulator pricing in Australia, motion vs haptic feedback, the Simagic ecosystem, junior setups, screen configurations and nationwide delivery.",
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
        title="Sim Racing Buying Guides"
        lead="Written from hands-on experience with the builds we assemble — not affiliate parts lists."
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
        <PhoneStrip title="Still Deciding?" lead="Call the workshop and we will walk through the compatibility checker with you." />
      </div>
    </div>
  );
}
