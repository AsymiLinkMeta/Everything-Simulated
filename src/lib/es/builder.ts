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

export type StaffLayer = LayerRow & { id: string };

export async function staffListLayers(): Promise<StaffLayer[]> {
  const { data, error } = await supabase.from("builder_layers").select("id, category, sku, image_url, z, label").order("z");
  if (error) throw error;
  return (data ?? []) as StaffLayer[];
}

export async function staffSetBadge(sku: string, badge: string | null) {
  const { error } = await supabase.from("catalog_products").update({ builder_badge: badge }).eq("sku", sku);
  if (error) throw error;
}

export async function staffSaveLayer(row: { category: string; sku: string | null; image_url: string; z: number; label: string | null }) {
  const { error } = await supabase.from("builder_layers").insert(row);
  if (error) throw error;
}

export async function staffDeleteLayer(id: string) {
  const { error } = await supabase.from("builder_layers").delete().eq("id", id);
  if (error) throw error;
}
