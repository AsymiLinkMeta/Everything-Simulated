import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { fetchProducts } from "@/lib/es/product-cache";
import { checkCart, UNIQUE_CATEGORIES } from "@/lib/es/checkCart";
import { useCart } from "@/lib/es/cart-store";
import type { Product, ProductCategory } from "@/lib/es/types";
import { ProductTile } from "./bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STEPS: { id: ProductCategory | "more"; label: string; hint: string }[] = [
  { id: "chassis", label: "Chassis", hint: "The frame everything bolts to." },
  { id: "wheelbase", label: "Wheelbase", hint: "Torque and quick-release live here." },
  { id: "wheel", label: "Wheel", hint: "Match the QR on the base." },
  { id: "pedals", label: "Pedals", hint: "Load cell, hydraulic or entry." },
  { id: "seat", label: "Seat", hint: "Side mounts and driver size." },
  { id: "motion", label: "Motion", hint: "SR2 only on Exodus XR1." },
  { id: "monitor", label: "Screens", hint: "Single, triples or ultrawide." },
  { id: "mount", label: "Mounts", hint: "Monitor arms and decks." },
  { id: "pc", label: "PC", hint: "Optional race PC, or bring your own." },
  { id: "more", label: "The rest", hint: "Shifters, audio, adapters." },
];

const MORE: ProductCategory[] = [
  "shifter",
  "handbrake",
  "audio",
  "headset",
  "software",
  "adapter",
  "accessory",
];

export function BuildStudio() {
  const products = useQuery({ queryKey: ["products"], queryFn: () => fetchProducts() });
  const lines = useCart((s) => s.lines);
  const driverWeightKg = useCart((s) => s.driverWeightKg);
  const postcode = useCart((s) => s.postcode);
  const result = useCart((s) => s.result)();
  const [step, setStep] = useState(0);
  const [q, setQ] = useState("");
  const current = STEPS[step];

  const selectedByCat = useMemo(() => {
    const map = new Map<string, string>();
    for (const line of lines) {
      const item = (products.data ?? []).find((p) => p.sku === line.sku);
      if (item) map.set(item.category, item.sku);
    }
    return map;
  }, [lines, products.data]);

  const items = useMemo(() => {
    const all = products.data ?? [];
    const inStep =
      current.id === "more"
        ? all.filter((p) => MORE.includes(p.category))
        : all.filter((p) => p.category === current.id);
    const query = q.trim().toLowerCase();
    if (!query) return inStep;
    return inStep.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.brand.toLowerCase().includes(query) ||
        p.sku.toLowerCase().includes(query),
    );
  }, [products.data, current.id, q]);

  function conflicts(item: Product): boolean {
    if (!lines.length || !result.ok) return false;
    const next = UNIQUE_CATEGORIES.has(item.category)
      ? [
          ...lines.filter((l) => {
            const p = (products.data ?? []).find((x) => x.sku === l.sku);
            return p?.category !== item.category;
          }),
          { sku: item.sku, qty: 1 },
        ]
      : [...lines, { sku: item.sku, qty: 1 }];
    const preview = checkCart({ lines: next, driverWeightKg, postcode });
    return !preview.ok;
  }

  return (
    <div className="min-w-0 space-y-6">
      <ol className="flex gap-2 overflow-x-auto pb-1">
        {STEPS.map((s, i) => {
          const picked =
            s.id === "more"
              ? lines.some((l) => {
                  const p = (products.data ?? []).find((x) => x.sku === l.sku);
                  return p && MORE.includes(p.category);
                })
              : Boolean(selectedByCat.get(s.id));
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => {
                  setStep(i);
                  setQ("");
                }}
                className={`min-h-11 rounded-md px-3 text-sm ${
                  i === step ? "bg-paper text-ink" : picked ? "border border-ok/40 text-ok" : "border border-line text-muted"
                }`}
              >
                {i + 1}. {s.label}
              </button>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="es-kicker">
            Step {step + 1} of {STEPS.length}
          </p>
          <h2 className="mt-1 text-2xl font-medium">{current.label}</h2>
          <p className="mt-1 text-sm text-muted">{current.hint}</p>
        </div>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${current.label.toLowerCase()}…`}
          className="max-w-xs"
        />
      </div>

      {products.isPending ? (
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="aspect-video animate-pulse rounded-card bg-raised" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="es-card p-6 text-sm text-muted">Nothing in this step. Skip it or search a different term.</div>
      ) : (
        <div className="grid min-w-0 grid-cols-2 gap-4 xl:grid-cols-3">
          {items.map((item) => (
            <div key={item.sku} className="relative">
              <ProductTile item={item} />
              {selectedByCat.get(item.category) === item.sku || lines.some((l) => l.sku === item.sku) ? (
                <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1 rounded-md bg-ok px-2 py-1 text-xs text-ink">
                  <Check className="size-3" /> In build
                </span>
              ) : conflicts(item) ? (
                <span className="pointer-events-none absolute left-3 top-3 rounded-md bg-esred/90 px-2 py-1 text-xs text-paper">
                  Conflicts
                </span>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
          <ChevronLeft className="size-4" /> Back
        </Button>
        <p className="text-xs text-muted">{result.ok ? "Build is compatible so far." : "Fix the blocks in the cart before deposit."}</p>
        <Button disabled={step === STEPS.length - 1} onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
          {selectedByCat.get(current.id as ProductCategory) || current.id === "more" ? "Next" : "Skip"} <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
