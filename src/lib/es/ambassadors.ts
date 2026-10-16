import { supabase } from "@/lib/db";
import { isPlaceholderCopy, publicCopy } from "./placeholder-copy";
import { livePackages, resolvePrebuildSlug } from "./prebuilds";
import type { PackageSpec } from "./types";

export type AgeBand = "U12" | "12-15" | "16-17" | "18+";
/** Tier keys live in the ambassador_tiers table (key, label, sort_order). */
export type AmbassadorTier = string;

export type TierRow = { key: string; label: string; description: string; sort_order: number };

export async function fetchTiers(): Promise<TierRow[]> {
  const { data, error } = await supabase.from("ambassador_tiers").select("key, label, description, sort_order").order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []) as TierRow[];
}

/** Label for a tier key; falls back to the key itself if the tiers haven't loaded. */
export function tierLabel(tiers: TierRow[] | undefined, key: string) {
  return tiers?.find((t) => t.key === key)?.label ?? key.replace(/_/g, " ");
}

export type AmbassadorSocial = {
  instagram?: string;
  tiktok?: string;
  youtube?: string;
  facebook?: string;
};

export type RigSpec = { label: string; value: string };

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
  crate?: string;
  rigNote?: string;
  rigSpecs?: RigSpec[];
  code: string;
  social?: AmbassadorSocial;
  published: boolean;
  tier: AmbassadorTier;
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
  tier: string;
};

const SELECT_COLS = "slug, name, photo, bio, motorsport, series, class_name, team_status, base, age_band, crate, rig_note, rig_specs, code, social, published, sort_order, tier";
const SELECT_COLS_FULL = `id, user_id, ${SELECT_COLS}` as const;

function toAmbassador(row: DbRow): Ambassador {
  const social = (row.social && typeof row.social === "object" ? row.social : {}) as AmbassadorSocial;
  const rigSpecs = Array.isArray(row.rig_specs)
    ? (row.rig_specs as RigSpec[]).filter((r) => r && typeof r.label === "string" && typeof r.value === "string")
    : [];
  return {
    slug: row.slug,
    name: row.name,
    photo: row.photo ?? undefined,
    bio: publicCopy(row.bio),
    motorsport: row.motorsport ?? undefined,
    series: row.series ?? undefined,
    className: row.class_name ?? undefined,
    teamStatus: row.team_status ?? undefined,
    base: row.base ?? undefined,
    ageBand: (row.age_band as AgeBand) ?? undefined,
    crate: row.crate ?? undefined,
    rigNote: publicCopy(row.rig_note) || undefined,
    rigSpecs: rigSpecs.length ? rigSpecs : undefined,
    code: row.code,
    social: Object.values(social).some(Boolean) ? social : undefined,
    published: row.published,
    tier: (row.tier as AmbassadorTier) || "sponsored_driver",
  };
}

/** In-site path that attributes the visit (the profile page, with the code). */
export function ambassadorLink(code: string, slug?: string) {
  const ref = `ref=${encodeURIComponent(code.toUpperCase())}`;
  return slug ? `/ambassadors/${slug}?${ref}` : `/?${ref}`;
}

/** Full share URL: what the QR code and "copy link" use. */
export function ambassadorShareUrl(a: { code: string; slug: string }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}${ambassadorLink(a.code, a.slug)}`;
}

export function ambassadorProfilePath(slug: string) {
  return `/ambassadors/${slug}`;
}

export function ambassadorProfileUrl(slug: string) {
  return `${window.location.origin}/ambassadors/${slug}`;
}

export function crateForAmbassador(a: Ambassador): PackageSpec | null {
  if (!a.crate) return null;
  const slug = resolvePrebuildSlug(a.crate);
  return livePackages().find((p) => p.slug === slug || p.slug === a.crate) ?? null;
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
      .select(SELECT_COLS)
      .order("sort_order");

    if (error) {
      fetchPromise = null;
      throw new Error(error.message);
    }

    cache = ((data ?? []) as DbRow[]).map(toAmbassador).filter((a) => a.published);
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

/** Editor view (staff and the ambassador themselves): raw copy, with seeded placeholder text flagged rather than hidden. */
export type AmbassadorRow = Ambassador & { id: string; userId?: string; sortOrder: number; placeholderBio: boolean };

type FullDbRow = DbRow & { id: string; user_id: string | null };

function toFullRow(row: FullDbRow): AmbassadorRow {
  const a = toAmbassador(row as DbRow);
  return {
    ...a,
    bio: (row.bio ?? "").trim(),
    rigNote: row.rig_note?.trim() || undefined,
    placeholderBio: isPlaceholderCopy(row.bio),
    id: row.id,
    userId: row.user_id ?? undefined,
    sortOrder: row.sort_order,
  };
}

export async function fetchMyAmbassadorProfile(): Promise<AmbassadorRow | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("ambassadors")
    .select(SELECT_COLS_FULL)
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
    .select(SELECT_COLS_FULL)
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
  tier?: AmbassadorTier;
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
    tier: input.tier ?? "sponsored_driver",
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

// ---------------------------------------------------------------------------
// Programme: dashboard, commissions, payouts, guardian approval, settings.
// All figures come from SECURITY DEFINER RPCs in 20261016090000_ambassador_program.sql.
// ---------------------------------------------------------------------------

export type CommissionStatus = "pending" | "approved" | "paid" | "void";

export type GuardianStatus = {
  required: boolean;
  status: "not_required" | "pending" | "approved" | "declined";
  guardian_name: string;
  guardian_email: string;
  method: "staff" | "email" | null;
  requested_at: string | null;
  decided_at: string | null;
  link_pending: boolean;
  configured_method: "staff" | "email";
};

export type AmbassadorDashboard = {
  ambassador: { id: string; name: string; code: string; slug: string; published: boolean };
  days: number;
  rate: number | null;
  rate_source: "ambassador" | "default" | "unset";
  clicks: number;
  visitors: number;
  clicks_by_day: { day: string; clicks: number }[];
  leads: number;
  orders: number;
  sales: number;
  sales_ex_gst: number;
  earnings: { pending: number; approved: number; paid: number; uncalculated: number };
  commissions: {
    ref: string;
    date: string;
    basis_ex_gst: number;
    rate: number | null;
    amount_cents: number | null;
    status: CommissionStatus;
    void_reason: string | null;
    paid_at: string | null;
  }[];
  guardian: GuardianStatus;
};

function rpcError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function fetchAmbassadorDashboard(ambassadorId?: string | null, days = 90): Promise<AmbassadorDashboard | null> {
  const { data, error } = await supabase.rpc("ambassador_dashboard", { p_ambassador: ambassadorId ?? null, p_days: days });
  rpcError(error);
  return (data as AmbassadorDashboard | null) ?? null;
}

export async function setGuardian(ambassadorId: string, name: string, email: string): Promise<GuardianStatus> {
  const { data, error } = await supabase.rpc("ambassador_set_guardian", { p_ambassador: ambassadorId, p_name: name, p_email: email });
  rpcError(error);
  return data as GuardianStatus;
}

/** Email method: sends the guardian a single-use approval link (guardian-consent function). */
export async function sendGuardianEmail(ambassadorId: string) {
  const { data, error } = await supabase.functions.invoke("guardian-consent", { body: { ambassadorId } });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const msg = ctx ? ((await ctx.json().catch(() => null)) as { error?: string } | null)?.error : null;
    throw new Error(msg || error.message);
  }
  return data as { ok: boolean; sent: boolean };
}

export async function guardianLinkInfo(token: string) {
  const { data, error } = await supabase.rpc("guardian_link_info", { p_token: token });
  rpcError(error);
  return data as { ambassador_name: string; guardian_name: string; expires: string } | null;
}

export async function confirmGuardian(token: string, approve: boolean) {
  const { data, error } = await supabase.rpc("confirm_guardian_consent", { p_token: token, p_approve: approve });
  rpcError(error);
  return data as { ok: boolean; approved: boolean; ambassador_name: string };
}

export async function staffGuardianSignoff(ambassadorId: string, note: string) {
  const { data, error } = await supabase.rpc("staff_guardian_signoff", { p_ambassador: ambassadorId, p_note: note });
  rpcError(error);
  invalidateAmbassadorCache();
  return data as GuardianStatus;
}

export async function staffGuardianDecline(ambassadorId: string, note: string) {
  const { data, error } = await supabase.rpc("staff_guardian_decline", { p_ambassador: ambassadorId, p_note: note });
  rpcError(error);
  invalidateAmbassadorCache();
  return data as GuardianStatus;
}

export type ProgrammeSettings = {
  default_commission_rate: number | null;
  commission_basis: "items" | "items_and_freight";
  guardian_method: "staff" | "email";
  guardian_link_days: number;
};

export async function staffFetchProgrammeSettings(): Promise<ProgrammeSettings> {
  const { data, error } = await supabase.from("ambassador_settings").select("key, value");
  rpcError(error);
  const m = Object.fromEntries((data ?? []).map((r) => [r.key as string, r.value]));
  return {
    default_commission_rate: typeof m.default_commission_rate === "number" ? m.default_commission_rate : null,
    commission_basis: m.commission_basis === "items_and_freight" ? "items_and_freight" : "items",
    guardian_method: m.guardian_method === "email" ? "email" : "staff",
    guardian_link_days: Number(m.guardian_link_days) || 14,
  };
}

export async function staffSetProgrammeSetting(key: keyof ProgrammeSettings, value: unknown) {
  const { data, error } = await supabase.rpc("staff_set_ambassador_setting", { p_key: key, p_value: value as never });
  rpcError(error);
  return data as { recalculated: number };
}

export async function staffFetchAmbassadorTerms(): Promise<Record<string, number | null>> {
  const { data, error } = await supabase.from("ambassador_terms").select("ambassador_id, commission_rate");
  rpcError(error);
  return Object.fromEntries((data ?? []).map((r) => [r.ambassador_id as string, r.commission_rate === null ? null : Number(r.commission_rate)]));
}

export async function staffFetchGuardians(): Promise<Record<string, GuardianStatus & { note: string }>> {
  const { data, error } = await supabase
    .from("ambassador_guardians")
    .select("ambassador_id, guardian_name, guardian_email, status, method, note, requested_at, decided_at, token_expires");
  rpcError(error);
  return Object.fromEntries(
    (data ?? []).map((g) => [
      g.ambassador_id as string,
      {
        required: g.status !== "not_required",
        status: g.status,
        guardian_name: g.guardian_name,
        guardian_email: g.guardian_email,
        method: g.method,
        note: g.note,
        requested_at: g.requested_at,
        decided_at: g.decided_at,
        link_pending: Boolean(g.token_expires && new Date(g.token_expires) > new Date()),
        configured_method: "staff",
      } as GuardianStatus & { note: string },
    ]),
  );
}

export async function staffSetAmbassadorRate(ambassadorId: string, rate: number | null) {
  const { data, error } = await supabase.rpc("staff_set_ambassador_rate", { p_ambassador: ambassadorId, p_rate: rate as never });
  rpcError(error);
  return data as { rate: number | null; effective: number | null; recalculated: number };
}

export type CommissionReportRow = {
  commission_id: string;
  ambassador_id: string;
  ambassador_name: string;
  ambassador_code: string;
  order_id: string;
  invoice_number: string | null;
  order_date: string;
  basis_ex_gst: number;
  rate: number | null;
  amount_cents: number | null;
  status: CommissionStatus;
  void_reason: string | null;
  approved_at: string | null;
  paid_at: string | null;
  payout_reference: string | null;
  guardian_ok: boolean;
};

export async function staffCommissionReport(opts: { from?: string; to?: string; status?: CommissionStatus | "" } = {}) {
  const { data, error } = await supabase.rpc("staff_commission_report", {
    p_from: opts.from || null,
    p_to: opts.to || null,
    p_status: opts.status || null,
  });
  rpcError(error);
  return (data ?? []) as CommissionReportRow[];
}

export async function staffMarkPayout(ambassadorId: string, commissionIds: string[], reference: string, note = "") {
  const { data, error } = await supabase.rpc("staff_mark_payout", {
    p_ambassador: ambassadorId,
    p_commissions: commissionIds,
    p_reference: reference,
    p_note: note,
  });
  rpcError(error);
  return data as { payout_id: string; total_cents: number; count: number };
}

/** CSV for the payouts report. Cents are exported as dollars with two decimals. */
export function commissionsToCsv(rows: CommissionReportRow[]) {
  const head = ["Ambassador", "Code", "Order", "Invoice", "Order date", "Basis ex GST", "Rate", "Commission", "Status", "Void reason", "Approved", "Paid", "Payout reference", "Guardian OK"];
  const money = (c: number | null) => (c === null ? "" : (c / 100).toFixed(2));
  const cell = (v: unknown) => {
    const t = v === null || v === undefined ? "" : String(v);
    // Quote everything; neutralise spreadsheet formulas.
    const safe = /^[=+\-@\t\r]/.test(t) ? `'${t}` : t;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const day = (d: string | null) => (d ? d.slice(0, 10) : "");
  const lines = rows.map((r) =>
    [r.ambassador_name, r.ambassador_code, r.order_id, r.invoice_number, day(r.order_date), money(r.basis_ex_gst), r.rate === null ? "" : r.rate,
      money(r.amount_cents), r.status, r.void_reason, day(r.approved_at), day(r.paid_at), r.payout_reference, r.guardian_ok ? "yes" : "no"]
      .map(cell)
      .join(","),
  );
  return [head.map(cell).join(","), ...lines].join("\r\n") + "\r\n";
}
