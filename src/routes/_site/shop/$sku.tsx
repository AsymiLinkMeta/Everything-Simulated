import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Boxes, Check, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CartPanel } from "@/components/es/cart-panel";
import { BackButton, JsonLd, Money, IncGst } from "@/components/es/bits";
import { fetchProducts, productImage } from "@/lib/es/product-cache";
import { useCart } from "@/lib/es/cart-store";
import { abs, breadcrumbLd, pageHead } from "@/lib/es/seo";

export const Route = createFileRoute("/_site/shop/$sku")({
  head: ({ params }) => {
    return pageHead({
      title: `${params.sku} | Sim racing Australia`,
      description: "Gold Coast assembled racing simulator part. Compatibility checked. Australia-wide freight.",
      path: `/shop/${params.sku}`,
    });
  },
  component: ProductPage,
});

function ProductPage() {
  const { sku } = Route.useParams();
  const products = useQuery({ queryKey: ["products"], queryFn: () => fetchProducts() });
  const item = products.data?.find((p) => p.sku === sku);

  const add = useCart((s) => s.add);
  const related = item
    ? (products.data ?? []).filter((p) => p.category === item.category && p.sku !== item.sku).slice(0, 3)
    : [];

  if (products.isPending) {
    return <div className="mx-auto w-full min-w-0 max-w-6xl overflow-x-hidden px-4 py-16"><BackButton /><p className="text-sm text-muted">Loading…</p></div>;
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
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: `${item.brand} ${item.name}`,
          sku: item.sku,
          brand: item.brand,
          image: abs(productImage(item)),
          offers: {
            "@type": "Offer",
            priceCurrency: "AUD",
            price: (item.sellExGst / 100).toFixed(0),
            availability:
              item.stock === "stock" ? "https://schema.org/InStock" : "https://schema.org/PreOrder",
          },
        }}
      />
      <div className="grid min-w-0 grid-cols-1 gap-8 lg:grid-cols-[1fr_1fr_320px]">
        <div>
          <img src={productImage(item)} alt={item.name} className="es-card h-80 w-full object-cover" />
          {item.images && item.images.length > 1 ? (
            <div className="es-shop-thumbs">
              {item.images.slice(0, 8).map((src) => (
                <img key={src} src={src} alt="" />
              ))}
            </div>
          ) : null}
        </div>
        <div>
          <p className="es-kicker">{item.brand}</p>
          <h1 className="mt-2 text-3xl font-medium">{item.name}</h1>
          <p className="mt-4 text-2xl">
            <Money cents={item.sellExGst} gst />
          </p>
          <p>
            <IncGst cents={item.sellExGst} />
          </p>
          <p className="mt-4 text-sm text-muted capitalize">
            {item.stock} · lead {item.leadWeeks[0]}–{item.leadWeeks[1]} weeks
          </p>
          {item.notes ? <p className="mt-3 text-sm text-muted">{item.notes}</p> : null}
          {item.maxNm ? <p className="mt-2 text-sm text-muted">{item.maxNm}Nm rating</p> : null}
          <Button className="mt-8" onClick={() => add(item.sku)}>
            Add to build
          </Button>
          <p className="mt-4 text-sm text-muted">
            <Link to="/compatibility" className="text-paper">
              Run compatibility
            </Link>{" "}
            after adding.
          </p>
        </div>
        <CartPanel compact />
      </div>

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
          <div className="mt-4 flex flex-col gap-2">
            {related.map((p) => (
              <Link key={p.sku} to="/shop/$sku" params={{ sku: p.sku }} className="es-card px-4 py-3 text-sm">
                {p.brand} {p.name}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
