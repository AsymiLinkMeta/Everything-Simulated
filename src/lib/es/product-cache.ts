import { supabase } from "@/lib/db";
import type { Product, ProductCategory, StockStatus } from "./types";

type DbRow = {
  sku: string;
  brand: string;
  name: string;
  category: string;
  sell_ex_gst: number;
  stock_status: string;
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
  whats_included: string[] | null;
  mount_compatibility: string | null;
  assembly_manual_url: string | null;
  specs: Record<string, string> | null;
  compare: string | null;
};

function toProduct(row: DbRow): Product {
  return {
    sku: row.sku,
    brand: row.brand,
    name: row.name,
    category: row.category as ProductCategory,
    sellExGst: row.sell_ex_gst,
    stock: row.stock_status as StockStatus,
    leadWeeks: [row.lead_weeks_min, row.lead_weeks_max],
    maxNm: row.max_nm ?? undefined,
    payloadKg: row.payload_kg ?? undefined,
    weightKg: row.weight_kg ?? undefined,
    mounts: row.mounts ?? undefined,
    qr: row.qr ?? undefined,
    notes: row.notes || undefined,
    image: row.image || row.image_url || undefined,
    whatsIncluded: row.whats_included ?? undefined,
    mountCompatibility: row.mount_compatibility || undefined,
    assemblyManualUrl: row.assembly_manual_url ?? undefined,
    specs: row.specs ?? undefined,
    compare: row.compare || undefined,
  };
}

let cache: Product[] | null = null;
let fetchPromise: Promise<Product[]> | null = null;

export async function fetchProducts(): Promise<Product[]> {
  if (cache) return cache;
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    const { data, error } = await supabase
      .from("catalog_products")
      .select(
        "sku, brand, name, category, sell_ex_gst, stock_status, lead_weeks_min, lead_weeks_max, description, notes, max_nm, payload_kg, weight_kg, mounts, qr, image, image_url, whats_included, mount_compatibility, assembly_manual_url, specs, compare",
      )
      .order("sku");

    if (error) throw error;
    cache = (data as DbRow[]).map(toProduct);
    return cache;
  })();

  return fetchPromise;
}

export function getCachedProducts(): Product[] {
  return cache ?? [];
}

export function getCachedProduct(sku: string): Product | undefined {
  return cache?.find((p) => p.sku === sku);
}

export function getCachedProductMap(): Record<string, Product> {
  return Object.fromEntries((cache ?? []).map((p) => [p.sku, p]));
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
  if (p.category === "motion") return "/rigs/motion.jpg";
  if (p.category === "chassis") return p.sku === "tr120s" ? "/rigs/starter.jpg" : "/rigs/haptic.jpg";
  if (p.category === "pc" || p.category === "monitor" || p.category === "mount") return "/rigs/haptic.jpg";
  return "/rigs/starter.jpg";
}
