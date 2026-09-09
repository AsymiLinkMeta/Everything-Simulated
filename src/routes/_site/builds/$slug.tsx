import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { BackButton, IncGst, JsonLd, LineName, Money } from "@/components/es/bits";
import { packageBySlug, PACKAGES } from "@/lib/es/catalog";
import { getCachedProductMap } from "@/lib/es/product-cache";
import { useCart } from "@/lib/es/cart-store";
import { abs, breadcrumbLd, pageHead } from "@/lib/es/seo";
import { checkCart } from "@/lib/es/checkCart";

export const Route = createFileRoute("/_site/builds/$slug")({
  loader: ({ params }) => {
    const pack = packageBySlug(params.slug);
    if (!pack) throw notFound();
    return pack;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    return pageHead({
      title: `${loaderData.name} | ${loaderData.kicker} racing simulator Australia`,
      description: `${loaderData.blurb} ${loaderData.priceExGst / 100} AUD + GST. Gold Coast built, delivered Australia-wide.`,
      path: `/builds/${loaderData.slug}`,
    });
  },
  component: BuildPage,
});

function BuildPage() {
  const pack = Route.useLoaderData();
  const loadPackage = useCart((s) => s.loadPackage);
  const result = checkCart({ lines: pack.lines });
  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl overflow-x-hidden px-4 py-16">
      <BackButton />
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Builds", path: "/builds" },
          { name: pack.name, path: `/builds/${pack.slug}` },
        ])}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: pack.name,
          description: pack.blurb,
          image: abs(pack.image),
          brand: "Everything Simulated",
          offers: {
            "@type": "Offer",
            priceCurrency: "AUD",
            price: (pack.priceExGst / 100).toFixed(0),
            availability: "https://schema.org/InStock",
            url: abs(`/builds/${pack.slug}`),
          },
        }}
      />
      <div className="grid gap-10 md:grid-cols-2">
        <img src={pack.image} alt={pack.name} className="es-card h-80 w-full object-cover md:h-full" />
        <div>
          <p className="es-kicker">{pack.kicker}</p>
          <h1 className="mt-3 text-4xl font-medium">{pack.name}</h1>
          <p className="mt-4 text-muted">{pack.blurb}</p>
          <p className="mt-6 text-3xl font-medium">
            <Money cents={pack.priceExGst} gst />
          </p>
          <p className="mt-1">
            <IncGst cents={pack.priceExGst} />
          </p>
          <ul className="mt-6 space-y-2 text-sm">
            {pack.highlights.map((h) => (
              <li key={h} className="text-muted">
                {h}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-muted">
            Lead {result.leadWeeks[0]}–{result.leadWeeks[1]} weeks · Checker {result.ok ? "clear" : "has holds"}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              onClick={() => {
                loadPackage(pack.slug);
              }}
            >
              Load into checker
            </Button>
            <Button variant="outline" asChild>
              <Link to="/compatibility">Open checker</Link>
            </Button>
          </div>
        </div>
      </div>
      <h2 className="mt-16 text-2xl font-medium">What’s in the crate</h2>
      <ul className="mt-6 divide-y divide-line rounded-card border border-line">
        {pack.lines.map((line) => {
          const item = getCachedProductMap()[line.sku];
          return (
            <li key={line.sku} className="flex items-center justify-between px-4 py-3 text-sm">
              <Link to="/shop/$sku" params={{ sku: line.sku }} className="hover:text-paper">
                <LineName sku={line.sku} />
                <span className="text-muted"> × {line.qty}</span>
              </Link>
              <span className="text-muted">{item ? <Money cents={item.sellExGst * line.qty} /> : null}</span>
            </li>
          );
        })}
      </ul>
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {PACKAGES.filter((p) => p.slug !== pack.slug).map((p) => (
          <Link key={p.slug} to="/builds/$slug" params={{ slug: p.slug }} className="es-card p-5">
            <p className="es-kicker">{p.kicker}</p>
            <p className="mt-1 font-medium">{p.name}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
