import type { Product } from "@/lib/es/types";

const p = (sku: string, category: Product["category"], sellExGst: number, extra: Partial<Product> = {}): Product => ({
  sku,
  brand: "Test",
  name: sku,
  category,
  sellExGst,
  stock: "indent",
  leadWeeks: [3, 6],
  ...extra,
});

export const PRODUCTS: Record<string, Product> = Object.fromEntries(
  [
    p("tr120s", "chassis", 150000, { maxNm: 15, weightKg: 30 }),
    p("xr1", "chassis", 300000, { maxNm: 30, weightKg: 45 }),
    p("alpha-evo-12", "wheelbase", 120000, { maxNm: 12, weightKg: 8 }),
    p("alpha-15", "wheelbase", 160000, { maxNm: 15, weightKg: 9 }),
    p("big-base", "wheelbase", 250000, { maxNm: 25, weightKg: 12 }),
    p("gt-neo", "wheel", 60000, { weightKg: 2 }),
    p("p1000", "pedals", 80000, { weightKg: 10 }),
    p("p1000-haptic", "pedals", 140000, { weightKg: 12 }),
    p("sr2", "motion", 900000, { payloadKg: 225, weightKg: 48, leadWeeks: [4, 8] }),
    p("quad-mount", "mount", 90000, { weightKg: 18 }),
    p("aoc-32", "monitor", 70000, { weightKg: 7 }),
    p("side-mount", "adapter", 15000, { weightKg: 2, leadWeeks: [1, 2] }),
    p("touring-seat", "seat", 50000, { weightKg: 14 }),
  ].map((x) => [x.sku, x]),
);
