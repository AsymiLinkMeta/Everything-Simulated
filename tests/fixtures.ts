import type { CompatibilityRule, Product } from "@/lib/es/types";

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

/** Mirrors the compatibility_rules seed rows (supabase/migrations). Test fixture only. */
export const RULES: CompatibilityRule[] = [
  {
    id: "qr-neo",
    left: "gt-neo",
    right: "alpha-evo-12",
    severity: "allow",
    reason: "Simagic QR matches Alpha EVO.",
  },
  {
    id: "qr-neo-15",
    left: "gt-neo",
    right: "alpha-15",
    severity: "allow",
    reason: "Simagic QR matches Alpha 15Nm.",
  },
  {
    id: "sr2-tr120",
    left: "sr2",
    right: "tr120s",
    severity: "block",
    reason: "SR2 is not rated on the TR120S deck. Upgrade to Exodus XR1.",
  },
  {
    id: "sr2-xr1",
    left: "sr2",
    right: "xr1",
    severity: "allow",
    reason: "XR1 is motion-ready within SR2 payload.",
  },
  {
    id: "hyd-tr120",
    left: "p1000-haptic",
    right: "tr120s",
    severity: "warn",
    reason: "Hydraulic P1000 needs the heavy pedal tray on TR120S.",
  },
  {
    id: "alpha-tr120",
    left: "alpha-evo-12",
    right: "tr120s",
    severity: "adapter",
    reason: "Alpha EVO on TR120S needs the Simagic side-mount kit.",
    adapterSku: "side-mount",
  },
  {
    id: "alpha15-tr120",
    left: "alpha-15",
    right: "tr120s",
    severity: "warn",
    reason: "15Nm is at the TR120S torque ceiling. XR1 is the stiffer home.",
  },
  {
    id: "quad-tr120",
    left: "quad-mount",
    right: "tr120s",
    severity: "block",
    reason: "Four-screen frame is specified on Exodus XR1 only.",
  },
];

/** Mirrors the freight_zones / pricing_settings seed in 20261015130000_server_pricing.sql. */
export const FREIGHT_CONFIG = {
  zones: [
    { id: "gold-coast", name: "Gold Coast", ranges: [[4200, 4299]] as [number, number][], base_cents: 0, per_kg_cents: 0, sort_order: 10, is_fallback: false },
    { id: "seq", name: "SEQ", ranges: [[4000, 4349], [4500, 4579]] as [number, number][], base_cents: 14500, per_kg_cents: 80, sort_order: 20, is_fallback: false },
    { id: "nsw", name: "Sydney / NSW", ranges: [[2000, 2999]] as [number, number][], base_cents: 24500, per_kg_cents: 110, sort_order: 50, is_fallback: false },
    { id: "vic", name: "Melbourne / VIC", ranges: [[3000, 3999]] as [number, number][], base_cents: 26500, per_kg_cents: 120, sort_order: 60, is_fallback: false },
    { id: "australia", name: "Australia", ranges: [] as [number, number][], base_cents: 29500, per_kg_cents: 130, sort_order: 1000, is_fallback: true },
  ],
  settings: {
    gst_rate: 0.1,
    freight_included_kg: 40,
    freight_min_kg: 8,
    freight_empty_kg: 40,
    freight_fallback_kg: 8,
    freight_motion_crate_cents: 14500,
    freight_motion_crate_local_cents: 8500,
    freight_screen_crate_cents: 6500,
    freight_screen_crate_min_monitors: 3,
    freight_multi_crate_cents: 2500,
    freight_category_kg: { chassis: 28, wheelbase: 8, wheel: 3, pedals: 10, motion: 48, monitor: 7, seat: 14 },
  },
};
