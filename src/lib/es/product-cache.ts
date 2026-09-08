import { supabase } from "@/lib/db";
import { PRODUCTS, RULES } from "./catalog";
import type { CompatibilityRule, ListingStatus, Product, ProductCategory, Severity, StockStatus } from "./types";

type DbRow = {
  sku: string;
  brand: string;
  name: string;
  category: string;
  sell_ex_gst: number;
  cost_ex_gst?: number | null;
  stock_status: string;
  listing_status?: string | null;
  qty_on_hand?: number | null;
  lead_weeks_min: number;
  lead_weeks_max: number;
  description: string;
  notes: string;
  max_nm: number | null;
  payload_kg: number | null;
  weight_kg: number | null;
  mounts: string[] | null;
  qr: string | null;
  image: string | null;
  image_url: string | null;
  images?: unknown;
  whats_included: string[] | null;
  mount_compatibility: string | null;
  assembly_manual_url: string | null;
  specs: Record<string, string> | null;
  compare: string | null;
};

function asImages(raw: unknown, fallback?: string | null): string[] {
  const list = Array.isArray(raw) ? raw.map(String) : [];
  if (fallback) list.unshift(fallback);
  return [...new Set(list.filter(Boolean))].slice(0, 8);
}

function toProduct(row: DbRow): Product {
  const images = asImages(row.images, row.image || row.image_url);
  return {
    sku: row.sku,
    brand: row.brand,
    name: row.name,
    category: row.category as ProductCategory,
    sellExGst: row.sell_ex_gst,
    costExGst: row.cost_ex_gst ?? undefined,
    stock: row.stock_status as StockStatus,
    listingStatus: (row.listing_status as ListingStatus) || "published",
    qtyOnHand: row.qty_on_hand ?? 0,
    leadWeeks: [row.lead_weeks_min, row.lead_weeks_max],
    maxNm: row.max_nm ?? undefined,
    payloadKg: row.payload_kg ?? undefined,
    weightKg: row.weight_kg ?? undefined,
    mounts: row.mounts ?? undefined,
    qr: row.qr ?? undefined,
    notes: row.notes || undefined,
    description: row.description || undefined,
    image: images[0],
    images,
    whatsIncluded: row.whats_included ?? undefined,
    mountCompatibility: row.mount_compatibility || undefined,
    assemblyManualUrl: row.assembly_manual_url ?? undefined,
    specs: row.specs ?? undefined,
    compare: row.compare || undefined,
  };
}

function toRule(row: Record<string, unknown>): CompatibilityRule {
  return {
    id: String(row.id),
    left: String(row.left_sku ?? row.left ?? ""),
    right: String(row.right_sku ?? row.right ?? ""),
    severity: (row.severity as Severity) || "warn",
    reason: String(row.reason ?? ""),
    adapterSku: row.adapter_sku ? String(row.adapter_sku) : undefined,
  };
}

let cache: Product[] | null = null;
let rulesCache: CompatibilityRule[] | null = null;
let fetchPromise: Promise<Product[]> | null = null;

export function getLiveRules(): CompatibilityRule[] {
  return rulesCache ?? RULES;
}

export function setLiveRules(next: CompatibilityRule[]) {
  rulesCache = next;
}

export async function fetchProducts(opts?: { includeDrafts?: boolean }): Promise<Product[]> {
  if (cache && !opts?.includeDrafts) return cache;
  if (fetchPromise && !opts?.includeDrafts) return fetchPromise;

  const run = (async () => {
    const [{ data, error }, rulesRes, overridesRes] = await Promise.all([
      supabase
        .from("catalog_products")
        .select(
          "sku, brand, name, category, sell_ex_gst, cost_ex_gst, stock_status, listing_status, qty_on_hand, lead_weeks_min, lead_weeks_max, description, notes, max_nm, payload_kg, weight_kg, mounts, qr, image, image_url, images, whats_included, mount_compatibility, assembly_manual_url, specs, compare",
        )
        .order("sku"),
      supabase.from("compatibility_rules").select("id, left_sku, right_sku, severity, reason, adapter_sku"),
      supabase.from("product_overrides").select("sku, sell_ex_gst"),
    ]);

    if (rulesRes.data?.length) {
      rulesCache = rulesRes.data.map((row) => toRule(row as Record<string, unknown>)).filter((r) => r.left && r.right);
    } else {
      rulesCache = RULES;
    }

    const overrides = Object.fromEntries((overridesRes.data ?? []).map((o) => [o.sku, o.sell_ex_gst]));

    let rows = (data as DbRow[] | null) ?? [];
    if (error || !rows.length) {
      cache = PRODUCTS.map((p) => ({ ...p, sellExGst: overrides[p.sku] ?? p.sellExGst }));
      return cache;
    }

    const products = rows.map((row) => {
      const product = toProduct(row);
      if (overrides[product.sku] != null) product.sellExGst = overrides[product.sku];
      return product;
    });

    const published = products.filter((p) => (p.listingStatus ?? "published") === "published");
    cache = published.length ? published : products;
    return opts?.includeDrafts ? products : cache;
  })();

  if (!opts?.includeDrafts) fetchPromise = run;
  return run;
}

export function getCachedProducts(): Product[] {
  return cache ?? PRODUCTS;
}

export function getCachedProduct(sku: string): Product | undefined {
  return getCachedProducts().find((p) => p.sku === sku);
}

export function getCachedProductMap(): Record<string, Product> {
  return Object.fromEntries(getCachedProducts().map((p) => [p.sku, p]));
}

export function invalidateProductCache() {
  cache = null;
  fetchPromise = null;
}

export function product(sku: string): Product | undefined {
  return getCachedProduct(sku);
}

export function productImage(p: Product): string {
  if (p.image) return p.image;
  if (p.images?.[0]) return p.images[0];
  if (p.category === "motion") return "/rigs/motion.jpg";
  if (p.category === "chassis") return p.sku === "tr120s" ? "/rigs/starter.jpg" : "/rigs/haptic.jpg";
  if (p.category === "pc" || p.category === "monitor" || p.category === "mount") return "/rigs/haptic.jpg";
  return "/rigs/starter.jpg";
}
