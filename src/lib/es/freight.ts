import type { CartLine, Product } from "./types";
import { getCachedProductMap } from "./product-cache";

/** Australia-wide crate freight from Gold Coast (4215), AUD cents ex GST. */

export type FreightQuote = {
  centsExGst: number;
  label: string;
  zone: string;
  kg: number;
  crates: number;
  breakdown: { label: string; cents: number }[];
};

type Zone = {
  name: string;
  test: (n: number) => boolean;
  base: number;
  perKg: number;
};

const ZONES: Zone[] = [
  { name: "Gold Coast", test: (n) => n >= 4200 && n <= 4299, base: 0, perKg: 0 },
  { name: "SEQ", test: (n) => (n >= 4000 && n <= 4349) || (n >= 4500 && n <= 4579), base: 14500, perKg: 80 },
  { name: "Northern NSW", test: (n) => n >= 2400 && n <= 2499, base: 18500, perKg: 90 },
  { name: "ACT", test: (n) => (n >= 2600 && n <= 2639) || (n >= 2900 && n <= 2920), base: 25500, perKg: 110 },
  { name: "Sydney / NSW", test: (n) => n >= 2000 && n <= 2999, base: 24500, perKg: 110 },
  { name: "Melbourne / VIC", test: (n) => n >= 3000 && n <= 3999, base: 26500, perKg: 120 },
  { name: "Adelaide / SA", test: (n) => n >= 5000 && n <= 5999, base: 28500, perKg: 130 },
  { name: "Perth / WA", test: (n) => n >= 6000 && n <= 6999, base: 32000, perKg: 160 },
  { name: "Tasmania", test: (n) => n >= 7000 && n <= 7999, base: 34000, perKg: 170 },
  { name: "Darwin / NT", test: (n) => n >= 800 && n <= 899, base: 39000, perKg: 190 },
];

const DEFAULT_KG: Record<string, number> = {
  chassis: 28,
  wheelbase: 8,
  wheel: 3,
  pedals: 10,
  shifter: 3,
  handbrake: 2,
  seat: 14,
  motion: 48,
  monitor: 7,
  mount: 18,
  pc: 12,
  audio: 6,
  headset: 1,
  software: 0,
  adapter: 2,
  accessory: 3,
};

function zoneFor(postcode?: string | null): Zone {
  const n = Number(String(postcode ?? "").replace(/\D/g, "").slice(0, 4));
  if (!Number.isFinite(n) || n <= 0) {
    return { name: "Australia", test: () => true, base: 29500, perKg: 130 };
  }
  return ZONES.find((z) => z.test(n)) ?? { name: "Australia", test: () => true, base: 29500, perKg: 130 };
}

function lineKg(sku: string, qty: number, products: Record<string, Product>): number {
  const p = products[sku];
  const each = p?.weightKg && p.weightKg > 0 ? p.weightKg : DEFAULT_KG[p?.category ?? ""] ?? 8;
  return each * Math.max(1, qty);
}

export function quoteFreight(opts: {
  postcode?: string | null;
  lines?: CartLine[];
  products?: Record<string, Product>;
}): FreightQuote {
  const products = opts.products ?? getCachedProductMap();
  const lines = (opts.lines ?? []).filter((l) => l.sku && l.qty > 0);
  const zone = zoneFor(opts.postcode);
  const kg = Math.max(
    8,
    Math.round(lines.reduce((sum, l) => sum + lineKg(l.sku, l.qty, products), 0) || 40),
  );
  const hasMotion = lines.some((l) => products[l.sku]?.category === "motion" || l.sku === "sr2");
  const monitors = lines
    .filter((l) => products[l.sku]?.category === "monitor")
    .reduce((n, l) => n + l.qty, 0);
  const crates = 1 + (hasMotion ? 1 : 0) + (monitors >= 3 ? 1 : 0);

  const breakdown: { label: string; cents: number }[] = [];
  if (zone.base === 0 && !hasMotion) {
    return {
      centsExGst: 0,
      label: "Gold Coast collection / local drop — no crate",
      zone: zone.name,
      kg,
      crates: 1,
      breakdown: [{ label: "Local Gold Coast", cents: 0 }],
    };
  }

  breakdown.push({ label: `${zone.name} crate`, cents: zone.base });
  const extraKg = Math.max(0, kg - 40);
  if (extraKg && zone.perKg) {
    breakdown.push({ label: `Weight ${kg} kg (first 40 included)`, cents: extraKg * zone.perKg });
  }
  if (hasMotion) {
    breakdown.push({ label: "Motion crate (SR2)", cents: zone.base === 0 ? 8500 : 14500 });
  }
  if (monitors >= 3) {
    breakdown.push({ label: "Screen crate", cents: 6500 });
  }
  if (crates > 1 && zone.base > 0) {
    breakdown.push({ label: `Multi-crate handling ×${crates}`, cents: (crates - 1) * 2500 });
  }

  const centsExGst = breakdown.reduce((s, b) => s + b.cents, 0);
  return {
    centsExGst,
    label: `${zone.name} crate freight from the Gold Coast`,
    zone: zone.name,
    kg,
    crates,
    breakdown,
  };
}

export function freightExGst(postcode?: string | null, lines?: CartLine[]): number {
  return quoteFreight({ postcode, lines }).centsExGst;
}

export function freightLabel(postcode?: string | null, lines?: CartLine[]): string {
  return quoteFreight({ postcode, lines }).label;
}
