import { supabase } from "@/lib/db";
import type { LayerRow } from "./builder-core";

export type BuilderData = { badges: Record<string, string>; layers: LayerRow[] };

/**
 * Badges (catalog_products.builder_badge) and preview layers (builder_layers), both staff-managed.
 * Either can be missing (e.g. before the migration reaches a database): the builder then shows
 * no badges and the drawn fallback preview, never invented labels.
 */
export async function fetchBuilderData(): Promise<BuilderData> {
  const [badgeRes, layerRes] = await Promise.all([
    supabase.from("catalog_products").select("sku, builder_badge").not("builder_badge", "is", null),
    supabase.from("builder_layers").select("category, sku, image_url, z, label").order("z"),
  ]);
  const badges: Record<string, string> = {};
  if (!badgeRes.error) for (const r of (badgeRes.data ?? []) as { sku: string; builder_badge: string | null }[]) if (r.builder_badge) badges[r.sku] = r.builder_badge;
  const layers = layerRes.error ? [] : ((layerRes.data ?? []) as LayerRow[]);
  return { badges, layers };
}
