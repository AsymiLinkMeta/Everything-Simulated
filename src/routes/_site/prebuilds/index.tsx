import { STAGE_IMAGES } from "@/lib/es/stage-images";
import { TrustBar } from "@/components/es/trust-bar";
import { createFileRoute, Link } from "@tanstack/react-router";
import { RigCard, RigCardSkeleton } from "@/components/es/rig-card";
import { useQuery } from "@tanstack/react-query";
import { JsonLd, LoadError } from "@/components/es/bits";
import { itemListLd, pageHead } from "@/lib/es/seo";
import { fetchPublishedPrebuilds } from "@/lib/es/prebuilds";
import { PageHero } from "@/components/es/section-page";

export const Route = createFileRoute("/_site/prebuilds/")({
  head: () =>
    pageHead({
      title: "Prebuilt Racing Simulators Australia | Ready to Ship | Everything Simulated",
      description: "Gold Coast assembled prebuilt racing simulators — tested, photographed and shipped Australia-wide. Choose a complete turn-key package or customise from individual components.",
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
        kicker="Prebuilds"
        title="Ready-to-drive rigs"
        lead="Complete racing simulators, assembled, tested and set up on the Gold Coast before they ship."
        image={STAGE_IMAGES["/prebuilds"]}
      />
      <TrustBar />
      <section className="ds-section ds-section-tight">
        <div className="ds-container">
          <h2 className="ds-visually-hidden">Available prebuilds</h2>
          {prebuilds.isPending ? (
            <div className="ds-rig-grid" role="status" aria-busy="true" aria-label="Loading prebuilds">{[1, 2, 3].map((i) => <RigCardSkeleton key={i} />)}</div>
          ) : prebuilds.isError ? (
            <LoadError what="the prebuilds" onRetry={() => void prebuilds.refetch()} />
          ) : items.length === 0 ? (
            <p className="ds-muted">No prebuilt rigs are listed right now. <Link to="/build" className="ds-link">Build one from parts</Link>.</p>
          ) : (
            <div className="ds-rig-grid">
              {items.map((p, i) => (
                <RigCard key={p.id} prebuild={p} priority={i === 0} />
              ))}
            </div>
          )}
          <p className="ds-small mt-10">
            Prefer to choose every part? <Link to="/build" className="ds-link">Open the builder</Link> or <Link to="/shop" className="ds-link">browse the shop</Link>.
          </p>
        </div>
      </section>
    </div>
  );
}
