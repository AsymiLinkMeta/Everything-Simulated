import { createFileRoute, Link, applyHeadPayload } from "@tanstack/react-router";
import { SiteImage } from "@/components/es/site-image";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { EsFallback } from "@/components/es/product-photo";
import { RigCard } from "@/components/es/rig-card";
import { JsonLd, LineName, Money } from "@/components/es/bits";
import { StickyBuyBar } from "@/components/es/sticky-buy-bar";
import { TrustBar } from "@/components/es/trust-bar";
import { toast } from "@/lib/toast";
import { breadcrumbLd, pageHead, productLd } from "@/lib/es/seo";
import { fetchPrebuildBySlug, fetchPublishedPrebuilds } from "@/lib/es/prebuilds";
import { fetchProducts, getCachedProductMap } from "@/lib/es/product-cache";
import { useCart } from "@/lib/es/cart-store";


export const Route = createFileRoute("/_site/prebuilds/$slug")({
  head: ({ params }) =>
    pageHead({
      title: `${params.slug} | Prebuilt Racing Simulator | Everything Simulated`,
      description: `Gold Coast assembled prebuilt racing simulator — compatibility verified and shipped Australia-wide.`,
      path: `/prebuilds/${params.slug}`,
      type: "product",
    }),
  component: PrebuildDetailPage,
});

function PrebuildDetailPage() {
  const { slug = "" } = Route.useParams();
  const prebuild = useQuery({
    queryKey: ["prebuild", slug],
    queryFn: () => fetchPrebuildBySlug(slug),
    enabled: slug.length > 0,
  });
  const allPrebuilds = useQuery({ queryKey: ["prebuilds"], queryFn: fetchPublishedPrebuilds });
  const products = useQuery({ queryKey: ["products"], queryFn: () => fetchProducts() });
  const loadLines = useCart((s) => s.setLines);
  const cartPrebuild = useCart((s) => s.prebuildSlug);
  const p = prebuild.data;
  const [hero, setHero] = useState<string | null>(null);
  const [failed, setFailed] = useState<string[]>([]);
  const added = Boolean(p && cartPrebuild === p.slug);
  function addBuild() {
    if (!p) return;
    loadLines(p.components.map((c) => ({ sku: c.sku, qty: c.qty })), null, p.slug);
    toast.success(`${p.name} is in your cart`);
  }

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
      <div className="ds-container">
        <div className="ds-pdp" role="status" aria-busy="true" aria-label="Loading prebuild">
          <div className="ds-gallery-main ds-skeleton" />
          <div className="ds-buybox">
            <div className="ds-skeleton" style={{ height: "1rem", width: "25%" }} />
            <div className="ds-skeleton" style={{ height: "3rem", width: "80%", marginTop: "1rem" }} />
          </div>
        </div>
      </div>
    );
  }

  if (prebuild.isError) {
    return (
      <div role="alert" className="ds-container ds-section">
        <h1 className="ds-h1">We couldn't load this prebuild</h1>
        <p className="ds-lead mt-4">Check your connection and try again.</p>
        <button type="button" className="ds-btn mt-6" onClick={() => void prebuild.refetch()}>Try again</button>
      </div>
    );
  }

  if (!p) {
    return (
      <div className="ds-container ds-section">
        <h1 className="ds-h1">Prebuild not found</h1>
        <p className="ds-lead mt-4">This rig may have been removed or is no longer published.</p>
        <Link to="/prebuilds" className="ds-btn ds-btn-secondary mt-6">View all prebuilds</Link>
      </div>
    );
  }

  const productMap = products.data
    ? Object.fromEntries(products.data.map((item) => [item.sku, item]))
    : getCachedProductMap();
  const others = (allPrebuilds.data ?? []).filter((o) => o.id !== p.id).slice(0, 3);
  const photos = [...new Set([p.image, ...(p.gallery ?? [])].filter(Boolean))].filter(
    (src, i) => i === 0 || !failed.includes(src as string),
  ) as string[];
  const shown = hero && photos.includes(hero) ? hero : photos[0];
  const price = p.purchasable && p.effective_price_ex_gst ? p.effective_price_ex_gst : null;

  return (
    <div className="ds-container">
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
          priceExGst: p.effective_price_ex_gst ?? undefined,
          url: `/prebuilds/${p.slug}`,
          extras: (p.highlights ?? []).slice(0, 6).map((h) => ({ name: "Highlight", value: h })),
        })}
      />

      <div className="ds-pdp">
        <div className="min-w-0">
          <nav aria-label="Breadcrumb">
            <ol className="ds-crumbs">
              <li><Link to="/prebuilds">Prebuilds</Link></li>
              <li aria-current="page">{p.name}</li>
            </ol>
          </nav>
          <div className="ds-gallery-main">
            {shown ? (
              <SiteImage src={shown} alt={p.name} priority sizes="(min-width: 960px) 55vw, 100vw" />
            ) : (
              <EsFallback alt={p.name} fallbackKey="fallback:prebuild" label={p.kicker || "Prebuilt rig"} />
            )}
          </div>
          {photos.length > 1 ? (
            <div className="ds-thumbs">
              {photos.slice(0, 8).map((src, i) => (
                <button key={src} type="button" onClick={() => setHero(src)} aria-label={`Show photo ${i + 1}`} aria-current={shown === src}>
                  <SiteImage src={src} sizes="120px" onFailed={() => setFailed((f) => (f.includes(src) ? f : [...f, src]))} />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="ds-buybox">
          <p className="ds-eyebrow">{p.kicker || "Prebuilt rig"}</p>
          <h1 className="ds-h1">{p.name}</h1>
          {p.blurb ? <p className="ds-lead mt-4">{p.blurb}</p> : null}
          {price ? (
            <p className="ds-buybox-price">
              {p.price_source === "parts" ? "From " : ""}
              <Money cents={price} gst />
              <small>Prices exclude GST. GST and freight are added in the cart.</small>
            </p>
          ) : (
            <p className="ds-buybox-price">Enquire for price</p>
          )}
          <div className="ds-actions">
            {p.purchasable ? (
              <>
                <button type="button" className="ds-btn ds-btn-light ds-btn-lg ds-btn-block" onClick={addBuild} data-testid="prebuild-add" aria-pressed={added}>
                  {added ? <><Check className="size-4" aria-hidden="true" /> In your cart</> : "Add to cart"}
                </button>
                <Link to="/checkout" onClick={addBuild} className="ds-btn ds-btn-secondary ds-btn-lg ds-btn-block">
                  Buy this build
                </Link>
              </>
            ) : (
              <Link to="/contact" className="ds-btn ds-btn-lg ds-btn-block">Enquire about this build</Link>
            )}
          </div>
          {p.highlights.length > 0 ? (
            <ul className="ds-checklist mt-6">
              {p.highlights.map((h) => (
                <li key={h}><Check className="size-4" aria-hidden="true" />{h}</li>
              ))}
            </ul>
          ) : null}
          {p.purchasable ? (
            <p className="ds-small mt-6">
              Want to change a part? <Link to="/compatibility" className="ds-link">Customise it in the checker</Link>.
            </p>
          ) : null}
        </div>
      </div>

      <TrustBar />
      {price ? (
        <StickyBuyBar name={p.name} priceExGst={price} actionLabel={added ? "In your cart" : "Add to cart"} onAction={addBuild} />
      ) : null}

      <section className="ds-section">
        <div className="ds-grid-2">
          {p.components.length > 0 ? (
            <div>
              <h2 className="ds-h2">What's in the build</h2>
              <ul className="ds-lines mt-5">
                {p.components.map((comp) => {
                  const item = productMap[comp.sku];
                  return (
                    <li key={comp.sku}>
                      <Link to="/shop/$sku" params={{ sku: comp.sku }}>
                        <LineName sku={comp.sku} />
                        {comp.qty > 1 ? <span className="ds-muted"> × {comp.qty}</span> : null}
                      </Link>
                      <span className="ds-muted tabular-nums">{item && item.sellExGst > 0 ? <Money cents={item.sellExGst * comp.qty} /> : "Included"}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
          <div>
            {Object.keys(p.specs).length > 0 ? (
              <>
                <h2 className="ds-h2">Specifications</h2>
                <table className="ds-specs-table mt-5">
                  <tbody>
                    {Object.entries(p.specs).map(([key, val]) => (
                      <tr key={key}>
                        <th scope="row">{key}</th>
                        <td>{val}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : null}
            {p.capabilities.length > 0 ? (
              <>
                <h2 className="ds-h2 mt-10">Capabilities</h2>
                <ul className="ds-checklist mt-5">
                  {p.capabilities.map((c) => (
                    <li key={c}><Check className="size-4" aria-hidden="true" />{c}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        </div>
        {p.description ? (
          <div className="mt-12" style={{ maxWidth: "44rem" }}>
            <h2 className="ds-h2">About this build</h2>
            <div className="ds-body mt-4 whitespace-pre-line">{p.description}</div>
          </div>
        ) : null}
      </section>

      {others.length > 0 ? (
        <section className="ds-section ds-section-tight">
          <h2 className="ds-h2">Other prebuilds</h2>
          <div className="ds-rig-grid mt-6">
            {others.map((o) => (
              <RigCard key={o.id} prebuild={o} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
