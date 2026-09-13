import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { JsonLd, ProductTile } from "@/components/es/bits";
import { CartPanel } from "@/components/es/cart-panel";
import { fetchProducts } from "@/lib/es/product-cache";
import { itemListLd, pageHead } from "@/lib/es/seo";
import type { ProductCategory } from "@/lib/es/types";
import { PageHero } from "@/components/es/section-page";

export const Route = createFileRoute("/_site/shop/")({
  head: () =>
    pageHead({
      title: "Sim racing parts shop Australia | Simagic, Trak Racer, Exodus",
      description: "Shop Simagic wheelbases, Trak Racer and Exodus chassis, SIMRIG motion, AOC triples and race PCs. Gold Coast stocked, compatibility checked, shipped Australia-wide.",
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
  const items = useMemo(() => {
    const query = q.trim().toLowerCase();
    return (products.data ?? []).filter((p) => {
      if (cat !== "all" && p.category !== cat) return false;
      if (!query) return true;
      return p.name.toLowerCase().includes(query) || p.brand.toLowerCase().includes(query) || p.sku.toLowerCase().includes(query);
    });
  }, [cat, q, products.data]);
  return (
    <div>
      <JsonLd data={itemListLd("Sim racing parts Australia", "/shop", (products.data ?? []).slice(0, 40).map((p) => ({ name: `${p.brand} ${p.name}`, path: `/shop/${p.sku}` })))} />
      <PageHero
        kicker="Catalogue"
        title="The spec we actually bolt on."
        lead="Not a parts warehouse. Every SKU is something we mount, cable and crate."
        image="/rigs/starter.jpg"
      />
      <div className="es-body">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {CATS.map((c) => (
              <button key={c.id} type="button" onClick={() => setCat(c.id)} className={`min-h-11 shrink-0 px-3 text-sm tracking-wide uppercase ${cat === c.id ? "bg-paper text-ink" : "border border-line text-muted"}`}>
                {c.label}
              </button>
            ))}
          </div>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search SKU, brand, name" className="min-h-11 border border-line bg-transparent px-3 text-sm text-paper placeholder:text-muted sm:ml-auto sm:w-64" />
        </div>
        <div className="mt-8 grid min-w-0 gap-8 lg:grid-cols-[1fr_320px]">
          <div className="grid min-w-0 grid-cols-2 gap-4 xl:grid-cols-3">
            {items.length ? items.map((item) => <ProductTile key={item.sku} item={item} />) : <p className="col-span-full text-sm text-muted">No parts match that filter.</p>}
          </div>
          <div className="lg:sticky lg:top-24 lg:self-start">
            <CartPanel compact />
          </div>
        </div>
      </div>
    </div>
  );
}
