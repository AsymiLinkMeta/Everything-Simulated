import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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
    return <div className="mx-auto max-w-6xl px-4 py-16"><BackButton /><p className="text-sm text-muted">Loading…</p></div>;
  }

  if (!item) throw notFound();

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
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
      <div className="grid gap-8 lg:grid-cols-[1fr_1fr_320px]">
        <img src={productImage(item)} alt={item.name} className="es-card h-80 w-full object-cover" />
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
