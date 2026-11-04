import { supabase } from "@/lib/db";
import type { ProductCategory } from "./types";

/**
 * Site imagery that isn't a catalogue photo (category renders, fallbacks) lives in
 * public.site_media, keyed like "category:wheelbase" or "fallback:product". Nothing
 * here names a file: a missing key (or a missing table, before the migration is
 * applied) renders the plain Everything Simulated tile instead.
 */
export type SiteMediaItem = { url: string; alt: string; width: number | null; height: number | null };
export type SiteMedia = Record<string, SiteMediaItem>;

export const SITE_MEDIA_QUERY_KEY = ["site-media"] as const;

/** Postgres "undefined_table" and PostgREST "table not in schema cache". */
const MISSING_TABLE = new Set(["42P01", "PGRST205"]);

export function isMissingTable(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && MISSING_TABLE.has(code);
}

const SAFE_URL = /^(\/(?!\/)[^\s]+|https:\/\/[^\s]+)$/;

export function toSiteMedia(rows: unknown[]): SiteMedia {
  const out: SiteMedia = {};
  for (const raw of rows) {
    const r = raw as Partial<{ key: string; url: string; alt: string; width: number; height: number }>;
    if (typeof r.key !== "string" || typeof r.url !== "string") continue;
    const url = r.url.trim();
    if (!SAFE_URL.test(url)) continue;
    out[r.key] = {
      url,
      alt: typeof r.alt === "string" ? r.alt : "",
      width: typeof r.width === "number" ? r.width : null,
      height: typeof r.height === "number" ? r.height : null,
    };
  }
  return out;
}

export async function fetchSiteMedia(): Promise<SiteMedia> {
  const { data, error } = await supabase.from("site_media").select("key, url, alt, width, height");
  if (error) {
    if (isMissingTable(error)) return {};
    throw error;
  }
  return toSiteMedia((data ?? []) as unknown[]);
}

/** The render for a category, else the generic product fallback, else null. */
export function categoryMedia(media: SiteMedia | undefined, category: ProductCategory | string | null | undefined, fallbackKey = "fallback:product"): SiteMediaItem | null {
  if (!media) return null;
  if (category && media[`category:${category}`]) return media[`category:${category}`];
  return media[fallbackKey] ?? null;
}

export const CATEGORY_LABEL: Record<ProductCategory, string> = {
  chassis: "Cockpit",
  wheelbase: "Wheelbase",
  wheel: "Wheel",
  pedals: "Pedals",
  shifter: "Shifter",
  handbrake: "Handbrake",
  seat: "Seat",
  motion: "Motion",
  monitor: "Screen",
  mount: "Mount",
  pc: "Sim PC",
  audio: "Audio",
  headset: "VR headset",
  software: "Software",
  adapter: "Adapter",
  accessory: "Accessory",
};

export function categoryLabel(category: string | null | undefined): string {
  return (category && (CATEGORY_LABEL as Record<string, string>)[category]) || "Everything Simulated";
}
