import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { JsonLd, Money } from "@/components/es/bits";
import { itemListLd, pageHead } from "@/lib/es/seo";
import { fetchPublishedPrebuilds } from "@/lib/es/prebuilds";
import type { PrebuildWithComponents } from "@/lib/es/prebuilds";
import { PageHero } from "@/components/es/section-page";

export const Route = createFileRoute("/_site/prebuilds/")({
  head: () =>
    pageHead({
      title: "Prebuilt Racing Simulators | Everything Simulated",
      description: "Browse our range of prebuilt racing simulators. Gold Coast assembled, delivered Australia-wide. Choose a complete rig or customise from parts.",
      path: "/prebuilds",
    }),
  component: PrebuildsPage,
});

function PrebuildsPage() {
  const prebuilds = useQuery({ queryKey: ["prebuilds"], queryFn: fetchPublishedPrebuilds });
  const items = prebuilds.data ?? [];

  return (
    <div>
      <JsonLd data={itemListLd("Prebuilt racing simulators", "/prebuilds", items.map((p) => ({ name: p.name, path: `/prebuilds/${p.slug}` })))} />
      <PageHero
        kicker="Turn-key"
        title="Prebuilt crates."
        lead="Each rig is assembled, tested and photographed on the Gold Coast before it ships."
        image="/rigs/motion.jpg"
      />
      <div className="es-body">
        {prebuilds.isPending ? (
          <div className="es-pack-grid">{[1, 2, 3].map((i) => <div key={i} className="aspect-square animate-pulse bg-raised" />)}</div>
        ) : items.length === 0 ? (
          <p className="text-muted">No prebuilt rigs available right now.</p>
        ) : (
          <div className="es-pack-grid">
            {items.map((p) => (
              <PrebuildCard key={p.id} prebuild={p} />
            ))}
          </div>
        )}
        <p className="mt-10 text-sm text-muted">
          Prefer parts? <Link to="/shop" className="text-paper">Open the shop</Link> or <Link to="/compatibility" className="text-paper">run the checker</Link>.
        </p>
      </div>
    </div>
  );
}

function PrebuildCard({ prebuild }: { prebuild: PrebuildWithComponents }) {
  return (
    <Link to="/prebuilds/$slug" params={{ slug: prebuild.slug }} className="es-pack-tile">
      <div className="es-pack-tile-frame">
        {prebuild.image ? <img src={prebuild.image} alt={prebuild.name} /> : <div className="grid size-full place-items-center bg-raised text-muted">No image</div>}
      </div>
      <div className="es-pack-tile-meta">
        <h3>{prebuild.name}</h3>
        <p className="mt-2 text-sm text-muted">{prebuild.blurb}</p>
        <p className="mt-3 text-lg font-medium"><Money cents={prebuild.price_ex_gst} gst /></p>
      </div>
    </Link>
  );
}
