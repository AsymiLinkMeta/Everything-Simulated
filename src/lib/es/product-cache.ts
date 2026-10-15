import { supabase } from "@/lib/db";
import { setFreightConfig, type FreightConfig } from "./freight";
import type { CompatibilityRule, ListingStatus, Product, ProductCategory, Severity, StockStatus } from "./types";

type DbRow = {
  sku: string;
  brand: string;
  name: string;
  category: string;
  sell_ex_gst: number;
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
  enquiry_only?: boolean | null;
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
    basePriceExGst: row.sell_ex_gst,
    enquiryOnly: Boolean(row.enquiry_only),
    purchasable: false,
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

/** Compatibility rules from the database. Empty until the catalogue has loaded. */
export function getLiveRules(): CompatibilityRule[] {
  return rulesCache ?? [];
}

export function setLiveRules(next: CompatibilityRule[]) {
  rulesCache = next;
}

export async function fetchProducts(opts?: { includeDrafts?: boolean }): Promise<Product[]> {
  if (cache && !opts?.includeDrafts) return cache;
  if (fetchPromise && !opts?.includeDrafts) return fetchPromise;

  const run = (async () => {
    const [productsRes, rulesRes, pricesRes, zonesRes, settingsRes] = await Promise.all([
      supabase
        .from("catalog_products")
        .select(
          "sku, brand, name, category, sell_ex_gst, stock_status, listing_status, qty_on_hand, lead_weeks_min, lead_weeks_max, description, notes, max_nm, payload_kg, weight_kg, mounts, qr, image, image_url, images, whats_included, mount_compatibility, assembly_manual_url, specs, compare, enquiry_only",
        )
        .order("sku"),
      supabase.from("compatibility_rules").select("id, left_sku, right_sku, severity, reason, adapter_sku"),
      supabase.from("catalog_prices").select("sku, price_ex_gst, override_ex_gst, purchasable"),
      supabase.from("freight_zones").select("id, name, ranges, base_cents, per_kg_cents, sort_order, is_fallback").order("sort_order"),
      supabase.from("pricing_settings").select("key, value"),
    ]);
    const failed = productsRes.error ?? pricesRes.error ?? rulesRes.error;
    if (failed) {
      fetchPromise = null;
      throw new Error(`Could not load the catalogue: ${failed.message}`);
    }

    rulesCache = (rulesRes.data ?? []).map((row) => toRule(row as Record<string, unknown>)).filter((r) => r.left && r.right);
    if (!zonesRes.error && !settingsRes.error) {
      setFreightConfig({
        zones: (zonesRes.data ?? []) as FreightConfig["zones"],
        settings: Object.fromEntries((settingsRes.data ?? []).map((r) => [r.key, r.value])),
      });
    }

    const prices = new Map((pricesRes.data ?? []).map((p) => [p.sku as string, p]));
    const products = ((productsRes.data as DbRow[] | null) ?? []).map((row) => {
      const product = toProduct(row);
      const price = prices.get(product.sku);
      if (price) {
        product.sellExGst = Number(price.price_ex_gst) || 0;
        product.overrideExGst = price.override_ex_gst == null ? undefined : Number(price.override_ex_gst);
        product.purchasable = Boolean(price.purchasable);
      }
      return product;
    });

    const published = products.filter((p) => (p.listingStatus ?? "published") === "published");
    cache = published;
    return opts?.includeDrafts ? products : cache;
  })();

  if (!opts?.includeDrafts) fetchPromise = run;
  return run;
}

export function getCachedProducts(): Product[] {
  return cache ?? [];
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
  if (p.category === "chassis" || p.category === "pc" || p.category === "monitor" || p.category === "mount") return "/rigs/haptic.jpg";
  return "/rigs/starter.jpg";
}
