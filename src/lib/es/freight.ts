import type { CartLine, Product } from "./types";
import { getCachedProductMap } from "./product-cache";

export type FreightQuote = {
  centsExGst: number;
  label: string;
  zone: string;
  kg: number;
  crates: number;
  breakdown: { label: string; cents: number }[];
};

/**
 * Freight zones and crate rules live in the database (freight_zones and
 * pricing_settings). This module is a display-only mirror of the
 * quote_cart() SQL so the cart can update as you type; the order is
 * always charged what quote_cart() returns.
 */
export type FreightZoneRow = {
  id: string;
  name: string;
  ranges: [number, number][];
  base_cents: number;
  per_kg_cents: number;
  sort_order: number;
  is_fallback: boolean;
};

export type FreightConfig = {
  zones: FreightZoneRow[];
  settings: Record<string, unknown>;
};

let config: FreightConfig | null = null;

export function setFreightConfig(next: FreightConfig) {
  config = next;
}

export function getFreightConfig(): FreightConfig | null {
  return config;
}

function num(key: string): number {
  const v = Number(config?.settings[key]);
  return Number.isFinite(v) ? v : 0;
}

function zoneFor(postcode?: string | null): FreightZoneRow | null {
  if (!config) return null;
  const n = Number(String(postcode ?? "").replace(/\D/g, "").slice(0, 4));
  const fallback = config.zones.find((z) => z.is_fallback) ?? null;
  if (!Number.isFinite(n) || n <= 0) return fallback;
  const hit = [...config.zones]
    .filter((z) => !z.is_fallback)
    .sort((a, b) => a.sort_order - b.sort_order)
    .find((z) => (z.ranges ?? []).some(([lo, hi]) => n >= lo && n <= hi));
  return hit ?? fallback;
}

function lineKg(sku: string, qty: number, products: Record<string, Product>): number {
  const p = products[sku];
  if (!p) return 0;
  const catKg = (config?.settings.freight_category_kg ?? {}) as Record<string, number>;
  const each = p.weightKg && p.weightKg > 0 ? p.weightKg : catKg[p.category] ?? num("freight_fallback_kg");
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
  if (!zone || !lines.length) {
    return { centsExGst: 0, label: zone ? "" : "Freight is calculated at checkout", zone: zone?.name ?? "", kg: 0, crates: 0, breakdown: [] };
  }
  const kg = Math.max(
    num("freight_min_kg"),
    Math.round(lines.reduce((sum, l) => sum + lineKg(l.sku, l.qty, products), 0)) || num("freight_empty_kg"),
  );
  const hasMotion = lines.some((l) => products[l.sku]?.category === "motion");
  const monitors = lines
    .filter((l) => products[l.sku]?.category === "monitor")
    .reduce((n, l) => n + l.qty, 0);
  const screenCrate = monitors >= num("freight_screen_crate_min_monitors");
  const crates = 1 + (hasMotion ? 1 : 0) + (screenCrate ? 1 : 0);

  if (zone.base_cents === 0 && !hasMotion) {
    return {
      centsExGst: 0,
      label: `${zone.name} collection / local drop, no crate`,
      zone: zone.name,
      kg,
      crates: 1,
      breakdown: [{ label: `Local ${zone.name}`, cents: 0 }],
    };
  }

  const included = num("freight_included_kg");
  const breakdown: { label: string; cents: number }[] = [{ label: `${zone.name} crate`, cents: zone.base_cents }];
  if (kg > included && zone.per_kg_cents) {
    breakdown.push({ label: `Weight ${kg} kg (first ${included} included)`, cents: (kg - included) * zone.per_kg_cents });
  }
  if (hasMotion) {
    breakdown.push({
      label: "Motion crate",
      cents: zone.base_cents === 0 ? num("freight_motion_crate_local_cents") : num("freight_motion_crate_cents"),
    });
  }
  if (screenCrate) breakdown.push({ label: "Screen crate", cents: num("freight_screen_crate_cents") });
  if (crates > 1 && zone.base_cents > 0) {
    breakdown.push({ label: `Multi-crate handling x${crates}`, cents: (crates - 1) * num("freight_multi_crate_cents") });
  }

  return {
    centsExGst: breakdown.reduce((s, b) => s + b.cents, 0),
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
