import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { JsonLd, LoadError, ProductTile } from "@/components/es/bits";
import { fetchProducts } from "@/lib/es/product-cache";
import { itemListLd, pageHead } from "@/lib/es/seo";
import type { ProductCategory } from "@/lib/es/types";
import { PageHero, PhoneStrip } from "@/components/es/section-page";

export const Route = createFileRoute("/_site/shop/")({
  head: () =>
    pageHead({
      title: "Sim Racing Parts & Components Australia | Everything Simulated",
      description: "Shop direct-drive wheelbases, chassis, pedals, motion platforms, triple screens and race PCs. Gold Coast stocked, compatibility verified and shipped Australia-wide.",
      path: "/shop",
    }),
  component: Shop,
});

const CATS: { id: ProductCategory | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "chassis", label: "Chassis" },
  { id: "wheelbase", label: "Wheelbases" },
  { id: "wheel", label: "Wheels" },
  { id: "pedals", label: "Pedals" },
  { id: "motion", label: "Motion" },
  { id: "monitor", label: "Screens" },
  { id: "pc", label: "PC" },
  { id: "seat", label: "Seats" },
  { id: "shifter", label: "Shifters" },
  { id: "handbrake", label: "Handbrakes" },
  { id: "mount", label: "Mounts" },
  { id: "audio", label: "Audio" },
  { id: "headset", label: "Headsets" },
  { id: "software", label: "Software" },
  { id: "accessory", label: "Livery" },
  { id: "adapter", label: "Adapters" },
];

function Shop() {
  const [cat, setCat] = useState<(typeof CATS)[number]["id"]>("all");
  const [q, setQ] = useState("");
  const products = useQuery({ queryKey: ["products"], queryFn: () => fetchProducts() });
  const all = useMemo(() => products.data ?? [], [products.data]);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of all) m.set(p.category, (m.get(p.category) ?? 0) + 1);
    return m;
  }, [all]);
  const cats = CATS.filter((c) => c.id === "all" || counts.get(c.id));
  const items = useMemo(() => {
    const query = q.trim().toLowerCase();
    return all.filter((p) => {
      if (cat !== "all" && p.category !== cat) return false;
      if (!query) return true;
      return p.name.toLowerCase().includes(query) || p.brand.toLowerCase().includes(query) || p.sku.toLowerCase().includes(query);
    });
  }, [cat, q, all]);
  return (
    <div>
      <JsonLd data={itemListLd("Sim racing parts Australia", "/shop", all.slice(0, 40).map((p) => ({ name: `${p.brand} ${p.name}`, path: `/shop/${p.sku}` })))} />
      <PageHero
        kicker="Parts shop"
        title="Sim racing parts"
        lead="Every part here is one we install, wire and support. Add parts to your build and the cart checks they fit."
      />
      <div className="ds-shop-bar">
        <div className="ds-container">
          <div className="ds-chips" role="toolbar" aria-label="Filter by category">
            {cats.map((c) => (
              <button key={c.id} type="button" onClick={() => setCat(c.id)} className="ds-chip" aria-pressed={cat === c.id}>
                {c.label}
                {c.id !== "all" ? <small>{counts.get(c.id)}</small> : null}
              </button>
            ))}
          </div>
          <label className="ds-search">
            <Search className="size-4" aria-hidden="true" />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search parts" aria-label="Search parts" />
          </label>
        </div>
      </div>
      <section className="ds-section ds-section-tight">
        <div className="ds-container">
          <h2 className="ds-visually-hidden">Parts</h2>
          <p className="ds-small ds-muted" aria-live="polite">
            {products.isPending ? "Loading parts…" : `${items.length} ${items.length === 1 ? "part" : "parts"}`}
          </p>
          {products.isError ? (
            <LoadError what="the parts" onRetry={() => void products.refetch()} />
          ) : products.isPending ? (
            <div className="ds-product-grid" aria-hidden="true">
              {Array.from({ length: 8 }, (_, i) => <div key={i} className="ds-tile"><div className="ds-tile-media ds-skeleton" /></div>)}
            </div>
          ) : items.length ? (
            <div className="ds-product-grid">
              {items.map((item, i) => <ProductTile key={item.sku} item={item} priority={i < 2} />)}
            </div>
          ) : (
            <p className="ds-muted">No parts match that filter. <button type="button" className="ds-link" onClick={() => { setCat("all"); setQ(""); }}>Clear filters</button></p>
          )}
        </div>
      </section>
      <PhoneStrip title="Need help choosing?" lead="Call the workshop, or run the compatibility checker before you pay a deposit." />
    </div>
  );
}
