import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ProductTile } from "@/components/es/bits";
import { CartPanel } from "@/components/es/cart-panel";
import { fetchProducts } from "@/lib/es/product-cache";
import { pageHead } from "@/lib/es/seo";
import type { ProductCategory } from "@/lib/es/types";

export const Route = createFileRoute("/_site/shop/")({
  head: () =>
    pageHead({
      title: "Sim racing parts shop Australia | Simagic, Trak Racer, Exodus",
      description:
        "Shop Simagic wheelbases, Trak Racer and Exodus chassis, SIMRIG motion, AOC triples and race PCs. Gold Coast stocked, compatibility checked, shipped Australia-wide.",
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
  { id: "adapter", label: "Adapters" },
];

function Shop() {
  const [cat, setCat] = useState<(typeof CATS)[number]["id"]>("all");
  const products = useQuery({ queryKey: ["products"], queryFn: () => fetchProducts() });
  const items = useMemo(
    () => (products.data ?? []).filter((p) => cat === "all" || p.category === cat),
    [cat, products.data],
  );
  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl overflow-x-hidden px-4 py-16">
      <p className="es-kicker">Catalogue</p>
      <h1 className="mt-3 text-4xl font-medium">Shop the spec we actually bolt together</h1>
      <p className="mt-4 max-w-2xl text-muted">
        Not a parts warehouse. Every SKU is something we mount, cable and crate. The checker will
        block a bad mix before you pay a deposit.
      </p>
      <div className="mt-8 flex gap-2 overflow-x-auto pb-2">
        {CATS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCat(c.id)}
            className={`min-h-11 shrink-0 rounded-md px-3 text-sm ${cat === c.id ? "bg-paper text-ink" : "border border-line text-muted"}`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="mt-8 grid min-w-0 gap-8 lg:grid-cols-[1fr_320px]">
        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <ProductTile key={item.sku} item={item} />
          ))}
        </div>
        <div className="lg:sticky lg:top-24 lg:self-start">
          <CartPanel compact />
        </div>
      </div>
    </div>
  );
}
