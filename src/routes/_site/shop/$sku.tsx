import { createFileRoute, Link, notFound, applyHeadPayload } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Boxes, Check, Gauge, Package, ShieldCheck, ShoppingCart, Truck } from "lucide-react";
import { CheckPills, JsonLd, Money, ProductTile } from "@/components/es/bits";
import { leadTimeLabel } from "@/lib/es/lead-time";
import { categoryLabel } from "@/lib/es/site-media";
import { useCartDrawer } from "@/lib/es/cart-drawer-store";
import { fetchProducts, productImage } from "@/lib/es/product-cache";
import { ProductPhoto } from "@/components/es/product-photo";
import { StickyBuyBar } from "@/components/es/sticky-buy-bar";
import { productPhotos } from "@/lib/es/product-photos";
import { stockLabel } from "@/lib/es/stock";
import { UNIQUE_CATEGORIES } from "@/lib/es/checkCart";
import { toast } from "@/lib/toast";
import { useCart } from "@/lib/es/cart-store";
import { breadcrumbLd, catalogProductLd, pageHead } from "@/lib/es/seo";

export const Route = createFileRoute("/_site/shop/$sku")({
  head: ({ params }) => {
    return pageHead({
      title: `${params.sku} | Racing Simulator Component | Everything Simulated`,
      description: `${params.sku} — Gold Coast stocked racing simulator component. Compatibility verified, professionally assembled and shipped Australia-wide.`,
      path: `/shop/${params.sku}`,
      type: "product",
    });
  },
  component: ProductPage,
});

function ProductPage() {
  const { sku } = Route.useParams();
  const products = useQuery({ queryKey: ["products"], queryFn: () => fetchProducts() });
  const item = products.data?.find((p) => p.sku === sku);
  const add = useCart((s) => s.add);
  const showCart = useCartDrawer((s) => s.show);
  const result = useCart((s) => s.result)();
  const inCart = useCart((s) => s.lines.some((l) => l.sku === sku));
  const unique = item ? UNIQUE_CATEGORIES.has(item.category) : false;
  const addLabel = inCart ? (unique ? "In your cart" : "Add another") : "Add to cart";
  function addItem() {
    if (!item) return;
    add(item.sku);
    toast.success(`${item.name} added to your cart`, { action: { label: "View cart", onClick: showCart } });
  }
  const related = item
    ? (products.data ?? []).filter((p) => p.category === item.category && p.sku !== item.sku).slice(0, 4)
    : [];
  const uniqueGallery = item ? productPhotos([item.image, ...(item.images ?? [])]) : [];
  const [hero, setHero] = useState<string>("");
  const firstImage = uniqueGallery[0];

  useEffect(() => {
    if (firstImage) setHero(firstImage);
    if (item) {
      applyHeadPayload(
        pageHead({
          title: `${item.brand} ${item.name} | Everything Simulated`,
          description: (item.description || item.notes || `${item.brand} ${item.name} for Gold Coast assembled racing simulators.`).slice(0, 160),
          path: `/shop/${item.sku}`,
          image: productImage(item) ?? undefined,
          type: "product",
        }),
      );
    }
    // Keyed on SKU + lead image: re-run when the product changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.sku, firstImage]);

  if (products.isPending) {
    return (
      <div className="ds-container">
        <div className="ds-pdp" role="status" aria-busy="true" aria-label="Loading product">
          <div className="ds-gallery-main ds-skeleton" />
          <div className="ds-buybox">
            <div className="ds-skeleton" style={{ height: "1rem", width: "25%" }} />
            <div className="ds-skeleton" style={{ height: "3rem", width: "80%", marginTop: "1rem" }} />
            <div className="ds-skeleton" style={{ height: "2rem", width: "35%", marginTop: "1.5rem" }} />
          </div>
        </div>
      </div>
    );
  }

  if (!item) throw notFound();
  const lead = leadTimeLabel(item.leadWeeks);
  const details = [
    item.whatsIncluded?.length ? "included" : null,
    item.specs && Object.keys(item.specs).length ? "specs" : null,
    item.mountCompatibility ? "mounts" : null,
    item.compare ? "compare" : null,
  ].filter(Boolean);

  return (
    <div className="ds-container">
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Shop", path: "/shop" },
          { name: item.name, path: `/shop/${item.sku}` },
        ])}
      />
      <JsonLd data={catalogProductLd(item)} />
      <div className="ds-pdp">
        <div className="min-w-0">
          <nav aria-label="Breadcrumb">
            <ol className="ds-crumbs">
              <li><Link to="/shop">Shop</Link></li>
              <li><Link to="/shop">{categoryLabel(item.category)}</Link></li>
            </ol>
          </nav>
          <div className="ds-gallery-main">
            <ProductPhoto
              src={hero || productImage(item)}
              alt={item.name}
              category={item.category}
              priority
              sizes="(min-width: 960px) 55vw, 100vw"
            />
          </div>
          {uniqueGallery.length > 1 ? (
            <div className="ds-thumbs">
              {uniqueGallery.slice(0, 8).map((src, i) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setHero(src)}
                  aria-label={`Show photo ${i + 1}`}
                  aria-current={hero === src}
                >
                  <img src={src} alt="" loading="lazy" decoding="async" />
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="ds-buybox">
          <p className="ds-eyebrow">{item.brand}</p>
          <h1 className="ds-h1">{item.name}</h1>
          {item.purchasable ? (
            <p className="ds-buybox-price">
              <Money cents={item.sellExGst} gst />
              <small>Prices exclude GST. GST and freight are added in the cart.</small>
            </p>
          ) : (
            <p className="ds-buybox-price">Enquire for price</p>
          )}
          <div className="ds-actions">
            {item.purchasable ? (
              <button type="button" className="ds-btn ds-btn-light ds-btn-lg ds-btn-block" onClick={addItem} aria-pressed={inCart && unique}>
                {inCart ? <Check className="size-4" aria-hidden="true" /> : <ShoppingCart className="size-4" aria-hidden="true" />} {addLabel}
              </button>
            ) : (
              <Link to="/contact" className="ds-btn ds-btn-light ds-btn-lg ds-btn-block">Enquire for price</Link>
            )}
          </div>
          <ul className="ds-facts">
            <li data-testid="stock-line">
              <Truck className="size-4" aria-hidden="true" />
              <span>
                <strong>{stockLabel(item.stock).long || item.stock}</strong>
                {lead ? <> · usually {lead} to build and ship</> : null}
              </span>
            </li>
            <li>
              <ShieldCheck className="size-4" aria-hidden="true" />
              <span>Checked against the rest of your build before we take a deposit</span>
            </li>
            {item.maxNm ? (
              <li>
                <Gauge className="size-4" aria-hidden="true" />
                <span><strong>{item.maxNm} Nm</strong> rating</span>
              </li>
            ) : null}
          </ul>
          {inCart ? (
            <div className="mt-5">
              <CheckPills result={result} />
            </div>
          ) : null}
          {item.description ? <p className="ds-body mt-6">{item.description}</p> : null}
          {item.notes ? <p className="ds-small mt-3">{item.notes}</p> : null}
        </div>
      </div>
      {item.purchasable ? (
        <StickyBuyBar name={`${item.brand} ${item.name}`} priceExGst={item.sellExGst} actionLabel={addLabel} onAction={addItem} />
      ) : null}

      {details.length || item.assemblyManualUrl ? (
        <section className="ds-section ds-section-tight" aria-label="Details">
          <div className="ds-grid ds-grid-2">
            {item.whatsIncluded?.length ? (
              <div>
                <h2 className="ds-h3"><Package className="size-4" aria-hidden="true" /> What's included</h2>
                <ul className="ds-checklist">
                  {item.whatsIncluded.map((inc, i) => (
                    <li key={i}><Check className="size-4" aria-hidden="true" /> <span>{inc}</span></li>
                  ))}
                </ul>
              </div>
            ) : null}
            {item.specs && Object.keys(item.specs).length ? (
              <div>
                <h2 className="ds-h3">Specifications</h2>
                <table className="ds-specs-table">
                  <tbody>
                    {Object.entries(item.specs).map(([key, value]) => (
                      <tr key={key}><th scope="row">{key}</th><td>{value}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {item.mountCompatibility ? (
              <div>
                <h2 className="ds-h3"><Boxes className="size-4" aria-hidden="true" /> Mount compatibility</h2>
                <p className="ds-small whitespace-pre-line">{item.mountCompatibility}</p>
              </div>
            ) : null}
            {item.compare ? (
              <div>
                <h2 className="ds-h3">Compare</h2>
                <p className="ds-small whitespace-pre-line">{item.compare}</p>
              </div>
            ) : null}
            {item.assemblyManualUrl ? (
              <div>
                <h2 className="ds-h3"><BookOpen className="size-4" aria-hidden="true" /> Assembly manual</h2>
                <a href={item.assemblyManualUrl} target="_blank" rel="noopener noreferrer" className="ds-link">View assembly guide</a>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
      {related.length ? (
        <section className="ds-section ds-section-tight" aria-labelledby="related-title">
          <div className="ds-section-head">
            <h2 id="related-title" className="ds-h2">More {categoryLabel(item.category).toLowerCase()} options</h2>
          </div>
          <div className="ds-product-grid">
            {related.map((p) => (
              <ProductTile key={p.sku} item={p} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
