import { createFileRoute, Link, applyHeadPayload } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { BackButton, IncGst, JsonLd, LineName, Money } from "@/components/es/bits";
import { Button } from "@/components/ui/button";
import { breadcrumbLd, pageHead, productLd } from "@/lib/es/seo";
import { fetchPrebuildBySlug, fetchPublishedPrebuilds } from "@/lib/es/prebuilds";
import { fetchProducts, getCachedProductMap } from "@/lib/es/product-cache";
import { useCart } from "@/lib/es/cart-store";

import type { PrebuildWithComponents } from "@/lib/es/prebuilds";

export const Route = createFileRoute("/_site/prebuilds/$slug")({
  head: ({ params }) =>
    pageHead({
      title: `${params.slug} | Prebuilt racing simulator | Everything Simulated`,
      description: `Gold Coast assembled prebuilt racing simulator. Compatibility checked. Crate freight Australia-wide.`,
      path: `/prebuilds/${params.slug}`,
      type: "product",
    }),
  component: PrebuildDetailPage,
});

function PrebuildDetailPage() {
  const { slug } = Route.useParams();
  const prebuild = useQuery({ queryKey: ["prebuild", slug], queryFn: () => fetchPrebuildBySlug(slug) });
  const allPrebuilds = useQuery({ queryKey: ["prebuilds"], queryFn: fetchPublishedPrebuilds });
  const products = useQuery({ queryKey: ["products"], queryFn: () => fetchProducts() });
  const loadLines = useCart((s) => s.setLines);
  const p = prebuild.data;

  useEffect(() => {
    if (!p) return;
    applyHeadPayload(
      pageHead({
        title: `${p.name} | Everything Simulated`,
        description: (p.blurb || p.description || `${p.name} Gold Coast assembled racing simulator.`).slice(0, 160),
        path: `/prebuilds/${p.slug}`,
        image: p.image,
        type: "product",
      }),
    );
  }, [p]);

  if (prebuild.isPending) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-16">
        <div className="h-96 animate-pulse rounded-2xl bg-raised" />
      </div>
    );
  }

  if (!p) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-16 text-center">
        <h1 className="text-2xl font-medium">Prebuild not found</h1>
        <p className="mt-4 text-muted">This rig may have been removed or is no longer published.</p>
        <Link to="/prebuilds" className="mt-6 inline-block text-sm text-paper underline-offset-4 hover:underline">
          View all prebuilds
        </Link>
      </div>
    );
  }

  const productMap = products.data
    ? Object.fromEntries(products.data.map((item) => [item.sku, item]))
    : getCachedProductMap();
  const others = (allPrebuilds.data ?? []).filter((o) => o.id !== p.id).slice(0, 3);

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl overflow-x-hidden px-4 py-16">
      <BackButton />
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Prebuilds", path: "/prebuilds" },
          { name: p.name, path: `/prebuilds/${p.slug}` },
        ])}
      />
      <JsonLd
        data={productLd({
          name: p.name,
          brand: "Everything Simulated",
          description: p.blurb || p.description,
          image: p.image,
          priceExGst: p.price_ex_gst,
          url: `/prebuilds/${p.slug}`,
          extras: (p.highlights ?? []).slice(0, 6).map((h) => ({ name: "Highlight", value: h })),
        })}
      />

      <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
        {p.image ? (
          <img src={p.image} alt={p.name} className="es-card h-80 w-full object-cover md:h-full" />
        ) : (
          <div className="es-card flex h-80 items-center justify-center bg-raised text-muted md:h-full">
            No image
          </div>
        )}
        <div>
          {p.kicker && <p className="es-kicker">{p.kicker}</p>}
          <h1 className="mt-3 text-4xl font-medium">{p.name}</h1>
          {p.blurb && <p className="mt-4 text-muted">{p.blurb}</p>}
          <p className="mt-6 text-3xl font-medium">
            <Money cents={p.price_ex_gst} gst />
          </p>
          <p className="mt-1">
            <IncGst cents={p.price_ex_gst} />
          </p>

          {p.highlights.length > 0 && (
            <ul className="mt-6 space-y-2 text-sm">
              {p.highlights.map((h) => (
                <li key={h} className="text-muted">{h}</li>
              ))}
            </ul>
          )}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              onClick={() => {
                loadLines(p.components.map((c) => ({ sku: c.sku, qty: c.qty })));
              }}
            >
              Add to cart
            </Button>
            <Button variant="outline" asChild>
              <Link
                to="/checkout"
                onClick={() => loadLines(p.components.map((c) => ({ sku: c.sku, qty: c.qty })))}
              >
                Checkout this crate
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/compatibility">Open checker</Link>
            </Button>
          </div>
        </div>
      </div>

      {p.description && (
        <div className="mt-16">
          <h2 className="text-2xl font-medium">About this build</h2>
          <div className="mt-4 max-w-3xl whitespace-pre-line text-sm leading-7 text-muted">{p.description}</div>
        </div>
      )}

      {p.capabilities.length > 0 && (
        <div className="mt-12">
          <h2 className="text-2xl font-medium">Capabilities</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {p.capabilities.map((c) => (
              <li key={c} className="es-card flex items-center gap-3 px-4 py-3 text-sm">
                <span className="size-2 shrink-0 rounded-full bg-esred" />
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {Object.keys(p.specs).length > 0 && (
        <div className="mt-12">
          <h2 className="text-2xl font-medium">Specifications</h2>
          <dl className="mt-4 divide-y divide-line rounded-xl border border-line">
            {Object.entries(p.specs).map(([key, val]) => (
              <div key={key} className="flex justify-between px-4 py-3 text-sm">
                <dt className="font-medium">{key}</dt>
                <dd className="text-muted">{val}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {p.components.length > 0 && (
        <>
          <h2 className="mt-16 text-2xl font-medium">What's in the crate</h2>
          <ul className="mt-6 divide-y divide-line rounded-xl border border-line">
            {p.components.map((comp) => {
              const item = productMap[comp.sku];
              return (
                <li key={comp.sku} className="flex items-center justify-between px-4 py-3 text-sm">
                  <Link to="/shop/$sku" params={{ sku: comp.sku }} className="hover:text-paper">
                    <LineName sku={comp.sku} />
                    <span className="text-muted"> x {comp.qty}</span>
                  </Link>
                  <span className="text-muted">
                    {item ? <Money cents={item.sellExGst * comp.qty} /> : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {others.length > 0 && (
        <div className="mt-16">
          <h2 className="text-xl font-medium">Other prebuilds</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3">
            {others.map((o) => (
              <Link
                key={o.id}
                to="/prebuilds/$slug"
                params={{ slug: o.slug }}
                className="es-card p-5"
              >
                {o.kicker && <p className="es-kicker">{o.kicker}</p>}
                <p className="mt-1 font-medium">{o.name}</p>
                <p className="mt-1 text-sm text-muted"><Money cents={o.price_ex_gst} gst /></p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
