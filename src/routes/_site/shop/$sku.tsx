import { createFileRoute, Link, notFound, applyHeadPayload } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Boxes, Check, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CartPanel } from "@/components/es/cart-panel";
import { BackButton, CheckPills, JsonLd, Money, IncGst, ProductTile } from "@/components/es/bits";
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
  const result = useCart((s) => s.result)();
  const inCart = useCart((s) => s.lines.some((l) => l.sku === sku));
  const unique = item ? UNIQUE_CATEGORIES.has(item.category) : false;
  const addLabel = inCart ? (unique ? "In your cart" : "Add another") : "Add to cart";
  function addItem() {
    if (!item) return;
    add(item.sku);
    toast.success(`${item.name} added to your cart`);
  }
  const related = item
    ? (products.data ?? []).filter((p) => p.category === item.category && p.sku !== item.sku).slice(0, 3)
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
      <div className="mx-auto w-full min-w-0 max-w-6xl overflow-x-hidden px-4 py-16">
        <BackButton />
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  if (!item) throw notFound();

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl overflow-x-hidden px-4 py-16">
      <BackButton />
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Shop", path: "/shop" },
          { name: item.name, path: `/shop/${item.sku}` },
        ])}
      />
      <JsonLd data={catalogProductLd(item)} />
      <div className="grid min-w-0 grid-cols-1 gap-8 lg:grid-cols-[1fr_1fr_320px]">
        <div>
          <ProductPhoto
            src={hero || productImage(item)}
            alt={item.name}
            label={item.brand}
            priority
            sizes="(min-width: 1024px) 34vw, 100vw"
            className="es-card h-80 w-full object-cover md:h-[28rem]"
          />
          {uniqueGallery.length > 1 ? (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {uniqueGallery.slice(0, 8).map((src) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setHero(src)}
                  className={`size-16 shrink-0 overflow-hidden rounded-md border ${
                    hero === src ? "border-paper" : "border-line"
                  }`}
                  aria-label={`Show photo ${uniqueGallery.indexOf(src) + 1}`}
                  aria-pressed={hero === src}
                >
                  <img src={src} alt="" className="size-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div>
          <p className="es-kicker">{item.brand}</p>
          <h1 className="mt-2 text-3xl font-medium">{item.name}</h1>
          {item.purchasable ? (
            <>
              <p className="mt-4 text-2xl">
                <Money cents={item.sellExGst} gst />
              </p>
              <p>
                <IncGst cents={item.sellExGst} />
              </p>
            </>
          ) : (
            <p className="mt-4 text-2xl">Enquire for price</p>
          )}
          <p className="mt-4 text-sm text-muted" data-testid="stock-line">
            {stockLabel(item.stock).long || item.stock} · usually {item.leadWeeks[0]}–{item.leadWeeks[1]} weeks to build and ship
          </p>
          {item.description ? <p className="mt-4 text-sm leading-6 text-muted">{item.description}</p> : null}
          {item.notes ? <p className="mt-3 text-sm text-muted">{item.notes}</p> : null}
          {item.maxNm ? <p className="mt-2 text-sm text-muted">{item.maxNm}Nm rating</p> : null}
          <div className="mt-6">
            <CheckPills result={result} />
          </div>
          {item.purchasable ? (
            <Button className="mt-8" onClick={addItem}>
              {addLabel}
            </Button>
          ) : (
            <Button className="mt-8" asChild>
              <Link to="/contact">Enquire for price</Link>
            </Button>
          )}
          <p className="mt-4 text-sm text-muted">
            The cart checks every part against the rest of your build. If a mix won't work, we won't take a deposit on it.
          </p>
        </div>
        <CartPanel compact />
      </div>
      {item.purchasable ? (
        <StickyBuyBar name={`${item.brand} ${item.name}`} priceExGst={item.sellExGst} actionLabel={addLabel} onAction={addItem} />
      ) : null}

      {(item.whatsIncluded?.length || item.mountCompatibility || item.specs || item.compare || item.assemblyManualUrl) ? (
        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {item.whatsIncluded?.length ? (
            <div className="es-card p-5">
              <div className="flex items-center gap-2">
                <Package className="size-4 text-esred" />
                <h2 className="text-base font-medium">What's included</h2>
              </div>
              <ul className="mt-3 space-y-1.5">
                {item.whatsIncluded.map((inc, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-muted" />
                    <span>{inc}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {item.mountCompatibility ? (
            <div className="es-card p-5">
              <div className="flex items-center gap-2">
                <Boxes className="size-4 text-esred" />
                <h2 className="text-base font-medium">Mount compatibility</h2>
              </div>
              <p className="mt-3 text-sm text-muted whitespace-pre-line">{item.mountCompatibility}</p>
            </div>
          ) : null}

          {item.specs && Object.keys(item.specs).length ? (
            <div className="es-card p-5">
              <h2 className="text-base font-medium">Specifications</h2>
              <dl className="mt-3 divide-y divide-line">
                {Object.entries(item.specs).map(([key, value]) => (
                  <div key={key} className="flex justify-between gap-4 py-2 text-sm">
                    <dt className="text-muted">{key}</dt>
                    <dd className="text-right font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}

          {item.compare ? (
            <div className="es-card p-5">
              <h2 className="text-base font-medium">Compare</h2>
              <p className="mt-3 text-sm text-muted whitespace-pre-line">{item.compare}</p>
            </div>
          ) : null}

          {item.assemblyManualUrl ? (
            <div className="es-card p-5">
              <div className="flex items-center gap-2">
                <BookOpen className="size-4 text-esred" />
                <h2 className="text-base font-medium">Assembly manual</h2>
              </div>
              <a
                href={item.assemblyManualUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-sm text-paper underline underline-offset-4 hover:text-esred"
              >
                View assembly guide
              </a>
            </div>
          ) : null}
        </div>
      ) : null}
      {related.length ? (
        <div className="mt-16">
          <h2 className="text-xl font-medium">Same category</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {related.map((p) => (
              <ProductTile key={p.sku} item={p} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
