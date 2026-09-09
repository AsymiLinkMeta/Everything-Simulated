import { supabase, supabaseUrl, supabaseAnonKey } from "@/lib/db";
import type { StaffRole } from "./types";

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

export type PrebuildWithComponents = Prebuild & { components: PrebuildComponent[] };

// ---- Public ----

export async function fetchPublishedPrebuilds(): Promise<PrebuildWithComponents[]> {
  const { data, error } = await supabase
    .from("prebuilds")
    .select("*")
    .eq("status", "published")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  const prebuilds = (data ?? []) as Prebuild[];
  if (!prebuilds.length) return [];

  const ids = prebuilds.map((p) => p.id);
  const { data: comps } = await supabase
    .from("prebuild_components")
    .select("*")
    .in("prebuild_id", ids)
    .order("sort_order", { ascending: true });

  const compMap = new Map<string, PrebuildComponent[]>();
  for (const c of (comps ?? []) as PrebuildComponent[]) {
    const list = compMap.get(c.prebuild_id) ?? [];
    list.push(c);
    compMap.set(c.prebuild_id, list);
  }

  return prebuilds.map((p) => ({
    ...p,
    highlights: Array.isArray(p.highlights) ? p.highlights : [],
    specs: (p.specs && typeof p.specs === "object" && !Array.isArray(p.specs)) ? p.specs : {},
    capabilities: Array.isArray(p.capabilities) ? p.capabilities : [],
    components: compMap.get(p.id) ?? [],
  }));
}

export async function fetchFeaturedPrebuilds(): Promise<PrebuildWithComponents[]> {
  const all = await fetchPublishedPrebuilds();
  return all.filter((p) => p.featured);
}

export async function fetchPrebuildBySlug(slug: string): Promise<PrebuildWithComponents | null> {
  const { data, error } = await supabase
    .from("prebuilds")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const prebuild = data as Prebuild;
  const { data: comps } = await supabase
    .from("prebuild_components")
    .select("*")
    .eq("prebuild_id", prebuild.id)
    .order("sort_order", { ascending: true });

  return {
    ...prebuild,
    highlights: Array.isArray(prebuild.highlights) ? prebuild.highlights : [],
    specs: (prebuild.specs && typeof prebuild.specs === "object" && !Array.isArray(prebuild.specs)) ? prebuild.specs : {},
    capabilities: Array.isArray(prebuild.capabilities) ? prebuild.capabilities : [],
    components: (comps ?? []) as PrebuildComponent[],
  };
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

  const ids = prebuilds.map((p) => p.id);
  const { data: comps } = await supabase
    .from("prebuild_components")
    .select("*")
    .in("prebuild_id", ids)
    .order("sort_order", { ascending: true });

  const compMap = new Map<string, PrebuildComponent[]>();
  for (const c of (comps ?? []) as PrebuildComponent[]) {
    const list = compMap.get(c.prebuild_id) ?? [];
    list.push(c);
    compMap.set(c.prebuild_id, list);
  }

  return prebuilds.map((p) => ({
    ...p,
    highlights: Array.isArray(p.highlights) ? p.highlights : [],
    specs: (p.specs && typeof p.specs === "object" && !Array.isArray(p.specs)) ? p.specs : {},
    capabilities: Array.isArray(p.capabilities) ? p.capabilities : [],
    components: compMap.get(p.id) ?? [],
  }));
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
