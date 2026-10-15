import { supabase, supabaseUrl, supabaseAnonKey } from "@/lib/db";
import type { PackageSpec, StaffRole } from "./types";

export type AIPrebuildDraft = {
  name: string;
  slug: string;
  kicker: string;
  blurb: string;
  description: string;
  price_ex_gst: number;
  highlights: string[];
  specs: Record<string, string>;
  capabilities: string[];
  components: { sku: string; qty: number }[];
};

export async function generatePrebuildDraft(
  prompt: string,
  catalogSkus: string[],
): Promise<AIPrebuildDraft> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error("Sign in required");

  const response = await fetch(`${supabaseUrl}/functions/v1/generate-prebuild`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Apikey: supabaseAnonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt, catalogSkus }),
  });
  if (!response.ok) throw new Error("AI request failed");
  const body = (await response.json()) as { draft?: AIPrebuildDraft; error?: string };
  if (body.error) throw new Error(body.error);
  if (!body.draft) throw new Error("No draft returned");
  return body.draft;
}

const STAFF: StaffRole[] = ["sales", "workshop", "content", "support", "admin"];

async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  return user;
}

async function requireStaff(userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data || !STAFF.includes(data.role as StaffRole)) throw new Error("Staff access required");
  return data.role as StaffRole;
}

export type Prebuild = {
  id: string;
  slug: string;
  name: string;
  kicker: string;
  blurb: string;
  description: string;
  image: string;
  price_ex_gst: number;
  highlights: string[];
  specs: Record<string, string>;
  capabilities: string[];
  featured: boolean;
  sort_order: number;
  status: string;
  enquiry_only?: boolean;
  archived_at?: string | null;
  archived_reason?: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PrebuildComponent = {
  id: string;
  prebuild_id: string;
  sku: string;
  qty: number;
  sort_order: number;
};

export type PrebuildWithComponents = Prebuild & {
  components: PrebuildComponent[];
  /** From the prebuild_prices view: package price, or the sum of priced parts. null = enquire. */
  effective_price_ex_gst: number | null;
  purchasable: boolean;
  /** True when the list was loaded without the image; use fetchPrebuildImage / PrebuildPhoto. */
  imageDeferred?: boolean;
  /** 'parts' = no package price; the price is the sum of the listed parts (shown as "from"). */
  price_source: "package" | "parts" | null;
};

let prebuildCache: PrebuildWithComponents[] | null = null;

const SLUG_ALIASES: Record<string, string> = {
  "starter-rig": "starter",
  "haptic-racing-simulator": "haptic",
  "motion-racing-simulator": "motion",
};

export function resolvePrebuildSlug(slug: string) {
  return SLUG_ALIASES[slug] || slug;
}

type PriceRow = { id: string; price_ex_gst: number | null; purchasable: boolean; price_source?: "package" | "parts" | null };

function shapePrebuild(prebuild: Prebuild, comps: PrebuildComponent[], price?: PriceRow): PrebuildWithComponents {
  return {
    effective_price_ex_gst: price?.price_ex_gst ?? null,
    purchasable: Boolean(price?.purchasable),
    price_source: price?.price_source ?? null,
    ...prebuild,
    highlights: Array.isArray(prebuild.highlights) ? prebuild.highlights : [],
    specs: prebuild.specs && typeof prebuild.specs === "object" && !Array.isArray(prebuild.specs) ? prebuild.specs : {},
    capabilities: Array.isArray(prebuild.capabilities) ? prebuild.capabilities : [],
    components: comps,
  };
}

async function loadComponentsAndPrices(ids: string[]) {
  if (!ids.length) return { comps: new Map<string, PrebuildComponent[]>(), prices: new Map<string, PriceRow>() };
  const [compsRes, pricesRes] = await Promise.all([
    supabase.from("prebuild_components").select("*").in("prebuild_id", ids).order("sort_order", { ascending: true }),
    supabase.from("prebuild_prices").select("id, price_ex_gst, purchasable, price_source").in("id", ids),
  ]);
  if (compsRes.error) throw new Error(compsRes.error.message);
  if (pricesRes.error) throw new Error(pricesRes.error.message);
  const comps = new Map<string, PrebuildComponent[]>();
  for (const c of (compsRes.data ?? []) as PrebuildComponent[]) {
    const list = comps.get(c.prebuild_id) ?? [];
    list.push(c);
    comps.set(c.prebuild_id, list);
  }
  const prices = new Map(((pricesRes.data ?? []) as PriceRow[]).map((p) => [p.id, p]));
  return { comps, prices };
}

/** Published prebuilds from the database. Throws on error so pages can show an error state. */
// Home, footer and cart all ask for the published list on first paint; share one request.
let publishedInflight: Promise<PrebuildWithComponents[]> | null = null;

export function fetchPublishedPrebuilds(): Promise<PrebuildWithComponents[]> {
  publishedInflight ??= loadPublishedPrebuilds().finally(() => {
    publishedInflight = null;
  });
  return publishedInflight;
}

// Every column except image. Prebuild images can be inline data URIs (~50-100 KB each), so
// the list leaves them out and each card loads its own image when it nears the viewport
// (see fetchPrebuildImage / PrebuildPhoto). Listing pages then render without waiting on them.
const LIST_COLUMNS =
  "id, slug, name, kicker, blurb, description, price_ex_gst, highlights, specs, capabilities, featured, sort_order, status, enquiry_only, archived_at, archived_reason, created_by, created_at, updated_at";

async function loadPublishedPrebuilds(): Promise<PrebuildWithComponents[]> {
  const { data, error } = await supabase
    .from("prebuilds")
    .select(LIST_COLUMNS)
    .eq("status", "published")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  const prebuilds = ((data ?? []) as Omit<Prebuild, "image">[]).map((p) => ({ ...p, image: imageCache.get(p.id) ?? "" }));
  const { comps, prices } = await loadComponentsAndPrices(prebuilds.map((p) => p.id));
  const result = prebuilds.map((p) => ({ ...shapePrebuild(p, comps.get(p.id) ?? [], prices.get(p.id)), imageDeferred: !imageCache.has(p.id) }));
  prebuildCache = result;
  return result;
}

const imageCache = new Map<string, string>();
const imageInflight = new Map<string, Promise<string>>();

/** One prebuild's image (URL or data URI); "" when it has none. Cached for the session. */
export function fetchPrebuildImage(id: string): Promise<string> {
  const hit = imageCache.get(id);
  if (hit !== undefined) return Promise.resolve(hit);
  let p = imageInflight.get(id);
  if (!p) {
    p = (async () => {
      const { data, error } = await supabase.from("prebuilds").select("image").eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      const image = (data?.image as string | null) ?? "";
      imageCache.set(id, image);
      for (const c of prebuildCache ?? []) if (c.id === id) Object.assign(c, { image, imageDeferred: false });
      return image;
    })().finally(() => imageInflight.delete(id));
    imageInflight.set(id, p);
  }
  return p;
}

/** Name and slug of each published prebuild, for nav links. Much lighter than the full list (no images). */
export async function fetchPrebuildLinks(): Promise<{ slug: string; name: string }[]> {
  if (prebuildCache) return prebuildCache.map((p) => ({ slug: p.slug, name: p.name }));
  const { data, error } = await supabase
    .from("prebuilds")
    .select("slug, name")
    .eq("status", "published")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as { slug: string; name: string }[];
}

/** Home page order: every published prebuild, featured ones first, otherwise by sort order. */
export function orderForHome<T extends { featured?: boolean | null }>(all: T[]): T[] {
  return [...all.filter((p) => p.featured), ...all.filter((p) => !p.featured)];
}

export async function fetchFeaturedPrebuilds(): Promise<PrebuildWithComponents[]> {
  return orderForHome(await fetchPublishedPrebuilds());
}

export async function fetchPrebuildBySlug(slug: string): Promise<PrebuildWithComponents | null> {
  const wanted = resolvePrebuildSlug(slug);
  const slugs = [...new Set([slug, wanted])];
  // One round trip for the row and its parts (embedded), with the price lookup in parallel.
  const [rowRes, priceRes] = await Promise.all([
    supabase
      .from("prebuilds")
      .select("*, prebuild_components(*)")
      .in("slug", slugs)
      .eq("status", "published")
      .order("sort_order", { referencedTable: "prebuild_components", ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase.from("prebuild_prices").select("id, slug, price_ex_gst, purchasable, price_source").in("slug", slugs),
  ]);
  if (rowRes.error) throw new Error(rowRes.error.message);
  if (priceRes.error) throw new Error(priceRes.error.message);
  if (!rowRes.data) return null;
  const { prebuild_components: comps, ...prebuild } = rowRes.data as Prebuild & { prebuild_components: PrebuildComponent[] | null };
  const price = ((priceRes.data ?? []) as PriceRow[]).find((r) => r.id === prebuild.id);
  return shapePrebuild(prebuild, comps ?? [], price);
}

// ---- Staff ----

export async function staffListPrebuilds(): Promise<PrebuildWithComponents[]> {
  const user = await getCurrentUser();
  await requireStaff(user.id);

  const { data, error } = await supabase
    .from("prebuilds")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  const prebuilds = (data ?? []) as Prebuild[];
  if (!prebuilds.length) return [];

  const { comps, prices } = await loadComponentsAndPrices(prebuilds.map((p) => p.id));
  return prebuilds.map((p) => shapePrebuild(p, comps.get(p.id) ?? [], prices.get(p.id)));
}

export async function staffSavePrebuild(input: {
  id?: string;
  slug: string;
  name: string;
  kicker?: string;
  blurb?: string;
  description?: string;
  image?: string;
  price_ex_gst: number;
  highlights?: string[];
  specs?: Record<string, string>;
  capabilities?: string[];
  featured?: boolean;
  sort_order?: number;
  status?: string;
  enquiry_only?: boolean;
}) {
  const user = await getCurrentUser();
  await requireStaff(user.id);

  const row = {
    slug: input.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"),
    name: input.name.trim(),
    kicker: input.kicker ?? "",
    blurb: input.blurb ?? "",
    description: input.description ?? "",
    image: input.image ?? "",
    price_ex_gst: input.price_ex_gst,
    highlights: input.highlights ?? [],
    specs: input.specs ?? {},
    capabilities: input.capabilities ?? [],
    featured: input.featured ?? false,
    sort_order: input.sort_order ?? 0,
    status: input.status ?? "draft",
    enquiry_only: input.enquiry_only ?? false,
    updated_at: new Date().toISOString(),
    created_by: user.id,
  };

  if (input.id) {
    const { data, error } = await supabase
      .from("prebuilds")
      .update(row)
      .eq("id", input.id)
      .select("id, slug")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as { id: string; slug: string };
  }

  const { data, error } = await supabase
    .from("prebuilds")
    .insert(row)
    .select("id, slug")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as { id: string; slug: string };
}

export async function staffDeletePrebuild(id: string) {
  const user = await getCurrentUser();
  const role = await requireStaff(user.id);
  if (role !== "admin") throw new Error("Admin only");
  const { error } = await supabase.from("prebuilds").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function staffSetPrebuildComponents(prebuildId: string, components: { sku: string; qty: number }[]) {
  const user = await getCurrentUser();
  await requireStaff(user.id);

  await supabase.from("prebuild_components").delete().eq("prebuild_id", prebuildId);

  if (components.length) {
    const rows = components.map((c, i) => ({
      prebuild_id: prebuildId,
      sku: c.sku,
      qty: c.qty,
      sort_order: i,
    }));
    const { error } = await supabase.from("prebuild_components").insert(rows);
    if (error) throw new Error(error.message);
  }

  return { ok: true };
}

export async function staffReorderPrebuilds(ordered: { id: string; sort_order: number }[]) {
  const user = await getCurrentUser();
  await requireStaff(user.id);

  for (const item of ordered) {
    await supabase.from("prebuilds").update({ sort_order: item.sort_order }).eq("id", item.id);
  }

  return { ok: true };
}

export async function staffToggleFeatured(id: string, featured: boolean) {
  const user = await getCurrentUser();
  await requireStaff(user.id);
  const { error } = await supabase.from("prebuilds").update({ featured }).eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export function getCachedPrebuilds(): PrebuildWithComponents[] {
  return prebuildCache ?? [];
}

export function prebuildToPackage(p: PrebuildWithComponents): PackageSpec {
  return {
    id: p.id,
    imageDeferred: p.imageDeferred,
    slug: p.slug,
    name: p.name,
    kicker: p.kicker,
    priceExGst: p.effective_price_ex_gst ?? 0,
    blurb: p.blurb,
    image: p.image || (p.imageDeferred ? "" : "/rigs/starter.jpg"),
    lines: p.components.map((c) => ({ sku: c.sku, qty: c.qty })),
    highlights: p.highlights,
    popular: p.featured,
  };
}

/** Published prebuilds (already loaded) as package specs. Empty until fetchPublishedPrebuilds has run. */
export function livePackages(): PackageSpec[] {
  return getCachedPrebuilds().map(prebuildToPackage);
}

export async function hydratePrebuilds(): Promise<PrebuildWithComponents[]> {
  try {
    prebuildCache = await fetchPublishedPrebuilds();
  } catch {
    prebuildCache = prebuildCache ?? [];
  }
  return prebuildCache;
}
