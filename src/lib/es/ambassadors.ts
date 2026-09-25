import { supabase } from "@/lib/db";
import { PACKAGES, packageBySlug } from "./catalog";
import { livePackages } from "./prebuilds";
import type { PackageSpec } from "./types";

export type AgeBand = "U12" | "12-15" | "16-17" | "18+";

export type AmbassadorSocial = {
  instagram?: string;
  tiktok?: string;
  youtube?: string;
  facebook?: string;
};

export type RigSpec = { label: string; value: string };

/** Everything on the card is typed by the driver. No preset series list. */
export type Ambassador = {
  slug: string;
  name: string;
  photo?: string;
  bio: string;
  motorsport?: string;
  series?: string;
  className?: string;
  teamStatus?: string;
  base?: string;
  ageBand?: AgeBand;
  /** Live prebuild slug this driver showcases. */
  crate?: string;
  rigNote?: string;
  rigSpecs?: RigSpec[];
  code: string;
  social?: AmbassadorSocial;
  published: boolean;
};

type DbRow = {
  slug: string;
  name: string;
  photo: string | null;
  bio: string;
  motorsport: string | null;
  series: string | null;
  class_name: string | null;
  team_status: string | null;
  base: string | null;
  age_band: string | null;
  crate: string | null;
  rig_note: string | null;
  rig_specs: unknown;
  code: string;
  social: unknown;
  published: boolean;
  sort_order: number;
};

function toAmbassador(row: DbRow): Ambassador {
  const social = (row.social && typeof row.social === "object" ? row.social : {}) as AmbassadorSocial;
  const rigSpecs = Array.isArray(row.rig_specs)
    ? (row.rig_specs as RigSpec[]).filter((r) => r && typeof r.label === "string" && typeof r.value === "string")
    : [];
  return {
    slug: row.slug,
    name: row.name,
    photo: row.photo ?? undefined,
    bio: row.bio ?? "",
    motorsport: row.motorsport ?? undefined,
    series: row.series ?? undefined,
    className: row.class_name ?? undefined,
    teamStatus: row.team_status ?? undefined,
    base: row.base ?? undefined,
    ageBand: (row.age_band as AgeBand) ?? undefined,
    crate: row.crate ?? undefined,
    rigNote: row.rig_note ?? undefined,
    rigSpecs: rigSpecs.length ? rigSpecs : undefined,
    code: row.code,
    social: Object.values(social).some(Boolean) ? social : undefined,
    published: row.published,
  };
}

export function ambassadorLink(code: string) {
  return `/checkout?ref=${encodeURIComponent(code.toUpperCase())}`;
}

export function ambassadorProfilePath(slug: string) {
  return `/ambassadors/${slug}`;
}

export function crateForAmbassador(a: Ambassador): PackageSpec | null {
  if (!a.crate) return null;
  return livePackages().find((p) => p.slug === a.crate) ?? packageBySlug(a.crate) ?? PACKAGES.find((p) => p.slug === a.crate) ?? null;
}

export function specsForAmbassador(a: Ambassador): RigSpec[] {
  if (a.rigSpecs?.length) return a.rigSpecs;
  const crate = crateForAmbassador(a);
  return (crate?.highlights ?? []).map((value) => ({ label: "Spec", value }));
}

let cache: Ambassador[] | null = null;
let fetchPromise: Promise<Ambassador[]> | null = null;

export async function fetchAmbassadors(): Promise<Ambassador[]> {
  if (cache) return cache;
  if (fetchPromise) return fetchPromise;

  const run = (async () => {
    const { data, error } = await supabase
      .from("ambassadors")
      .select("slug, name, photo, bio, motorsport, series, class_name, team_status, base, age_band, crate, rig_note, rig_specs, code, social, published, sort_order")
      .order("sort_order");

    if (error || !data) {
      cache = [];
      return cache;
    }

    cache = (data as DbRow[]).map(toAmbassador).filter((a) => a.published);
    return cache;
  })();

  fetchPromise = run;
  return run;
}

export function getCachedAmbassadors(): Ambassador[] {
  return cache ?? [];
}

export function getCachedAmbassadorBySlug(slug: string): Ambassador | undefined {
  return getCachedAmbassadors().find((a) => a.slug === slug);
}

export function getCachedAmbassadorByCode(code: string): Ambassador | undefined {
  const upper = code.trim().toUpperCase();
  if (!upper) return undefined;
  return getCachedAmbassadors().find((a) => a.code === upper);
}

export function invalidateAmbassadorCache() {
  cache = null;
  fetchPromise = null;
}

export type AmbassadorRow = Ambassador & { userId?: string; sortOrder: number };

type FullDbRow = DbRow & { id: string; user_id: string | null };

function toFullRow(row: FullDbRow): AmbassadorRow {
  const a = toAmbassador(row as DbRow);
  return { ...a, userId: row.user_id ?? undefined, sortOrder: row.sort_order };
}

export async function fetchMyAmbassadorProfile(): Promise<AmbassadorRow | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("ambassadors")
    .select("id, slug, name, photo, bio, motorsport, series, class_name, team_status, base, age_band, crate, rig_note, rig_specs, code, social, published, sort_order, user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) return null;
  return toFullRow(data as FullDbRow);
}

export async function ambassadorSelfUpdate(fields: {
  bio?: string;
  photo?: string;
  motorsport?: string;
  series?: string;
  className?: string;
  teamStatus?: string;
  base?: string;
  ageBand?: string;
  social?: AmbassadorSocial;
  rigNote?: string;
  rigSpecs?: RigSpec[];
}) {
  const { data, error } = await supabase.rpc("ambassador_self_update", {
    p_bio: fields.bio ?? null,
    p_photo: fields.photo ?? null,
    p_motorsport: fields.motorsport ?? null,
    p_series: fields.series ?? null,
    p_class_name: fields.className ?? null,
    p_team_status: fields.teamStatus ?? null,
    p_base: fields.base ?? null,
    p_age_band: fields.ageBand ?? null,
    p_social: fields.social ? JSON.stringify(fields.social) : null,
    p_rig_note: fields.rigNote ?? null,
    p_rig_specs: fields.rigSpecs ? JSON.stringify(fields.rigSpecs) : null,
  });
  if (error) throw new Error(error.message);
  invalidateAmbassadorCache();
  return data;
}

export async function staffListAllAmbassadors(): Promise<AmbassadorRow[]> {
  const { data, error } = await supabase
    .from("ambassadors")
    .select("id, slug, name, photo, bio, motorsport, series, class_name, team_status, base, age_band, crate, rig_note, rig_specs, code, social, published, sort_order, user_id")
    .order("sort_order");
  if (error) throw new Error(error.message);
  return (data as FullDbRow[]).map(toFullRow);
}

export async function staffUpsertAmbassador(input: {
  slug: string;
  name: string;
  code: string;
  bio?: string;
  photo?: string;
  motorsport?: string;
  series?: string;
  className?: string;
  teamStatus?: string;
  base?: string;
  ageBand?: string;
  crate?: string;
  rigNote?: string;
  rigSpecs?: RigSpec[];
  social?: AmbassadorSocial;
  published?: boolean;
  sortOrder?: number;
  userId?: string;
}) {
  const row: Record<string, unknown> = {
    slug: input.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"),
    name: input.name.trim(),
    code: input.code.trim().toUpperCase(),
    bio: input.bio ?? "",
    photo: input.photo ?? null,
    motorsport: input.motorsport ?? null,
    series: input.series ?? null,
    class_name: input.className ?? null,
    team_status: input.teamStatus ?? null,
    base: input.base ?? null,
    age_band: input.ageBand ?? null,
    crate: input.crate ?? null,
    rig_note: input.rigNote ?? null,
    rig_specs: input.rigSpecs ?? [],
    social: input.social ?? {},
    published: input.published ?? false,
    sort_order: input.sortOrder ?? 0,
    user_id: input.userId ?? null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("ambassadors")
    .upsert(row, { onConflict: "slug" })
    .select("slug")
    .maybeSingle();
  if (error) throw new Error(error.message);
  invalidateAmbassadorCache();
  return { slug: data?.slug };
}

export async function staffDeleteAmbassador(slug: string) {
  const { error } = await supabase.from("ambassadors").delete().eq("slug", slug);
  if (error) throw new Error(error.message);
  invalidateAmbassadorCache();
  return { ok: true };
}
