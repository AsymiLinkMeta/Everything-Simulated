import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Money } from "@/components/es/bits";
import { pageHead } from "@/lib/es/seo";
import { fetchPublishedPrebuilds } from "@/lib/es/prebuilds";
import type { PrebuildWithComponents } from "@/lib/es/prebuilds";

export const Route = createFileRoute("/_site/prebuilds/")({
  head: () =>
    pageHead({
      title: "Prebuilt Racing Simulators | Everything Simulated",
      description:
        "Browse our range of prebuilt racing simulators. Gold Coast assembled, delivered Australia-wide. Choose a complete rig or customise from parts.",
      path: "/prebuilds",
    }),
  component: PrebuildsPage,
});

function PrebuildsPage() {
  const prebuilds = useQuery({ queryKey: ["prebuilds"], queryFn: fetchPublishedPrebuilds });
  const items = prebuilds.data ?? [];

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl overflow-x-hidden px-4 py-16">
      <p className="es-kicker">Turn-key</p>
      <h1 className="mt-3 text-4xl font-medium">Prebuilt Simulators</h1>
      <p className="mt-4 max-w-2xl text-muted">
        Each rig is assembled, tested and photographed on the Gold Coast before it ships.
        Pick a prebuilt or start from parts in the shop.
      </p>

      {prebuilds.isPending ? (
        <div className="mt-10 grid grid-cols-2 gap-6 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-raised" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="mt-10 text-muted">No prebuilt rigs available right now. Check back soon.</p>
      ) : (
        <div className="mt-10 grid grid-cols-2 gap-6 md:grid-cols-3">
          {items.map((p) => (
            <PrebuildCard key={p.id} prebuild={p} />
          ))}
        </div>
      )}

      <p className="mt-10 text-sm text-muted">
        Prefer to spec from parts?{" "}
        <Link to="/shop" className="text-paper">Open the shop</Link>{" "}
        or{" "}
        <Link to="/compatibility" className="text-paper">run the compatibility checker</Link>.
      </p>
    </div>
  );
}

function PrebuildCard({ prebuild }: { prebuild: PrebuildWithComponents }) {
  return (
    <Link
      to="/prebuilds/$slug"
      params={{ slug: prebuild.slug }}
      className="es-card group flex flex-col overflow-hidden"
    >
      <div className="relative aspect-video overflow-hidden">
        {prebuild.image ? (
          <img
            src={prebuild.image}
            alt={prebuild.name}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-raised text-muted">No image</div>
        )}
        {prebuild.kicker && (
          <span
            className="es-kicker"
            style={{ position: "absolute", left: 16, top: 16, background: "rgba(7,7,8,0.8)", padding: "4px 8px", borderRadius: 8 }}
          >
            {prebuild.kicker}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <h3 className="text-xl font-medium">{prebuild.name}</h3>
        <p className="text-sm text-muted">{prebuild.blurb}</p>
        <p className="mt-auto text-lg font-medium">
          <Money cents={prebuild.price_ex_gst} gst />
        </p>
      </div>
    </Link>
  );
}
