import { supabase } from "@/lib/db";
import { getProfile } from "./server";
import {
  AMBASSADORS,
  notesHaveAmbassadorCode,
  type AgeBand,
  type Ambassador,
  type AmbassadorDraft,
  type AmbassadorRecord,
} from "./ambassadors";
import type { ShopOrder } from "./crm-oms";

export type { AmbassadorDraft };

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || `amb-${Date.now().toString(36)}`;
}

function issueCode(name: string) {
  const base = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 12);
  return base || `ES${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

function rowToRecord(row: Record<string, unknown>): AmbassadorRecord {
  return {
    id: String(row.id ?? ""),
    slug: String(row.slug ?? ""),
    userId: (row.user_id as string) || null,
    name: String(row.name ?? ""),
    photo: (row.photo as string) || undefined,
    bio: String(row.bio ?? ""),
    motorsport: String(row.motorsport ?? ""),
    series: String(row.series ?? ""),
    className: String(row.class_name ?? ""),
    teamStatus: String(row.team_status ?? ""),
    base: String(row.base ?? ""),
    ageBand: (row.age_band as AgeBand) || undefined,
    crate: (row.crate as string) || undefined,
    code: String(row.code ?? "").toUpperCase(),
    social: {
      instagram: (row.instagram as string) || undefined,
      tiktok: (row.tiktok as string) || undefined,
      youtube: (row.youtube as string) || undefined,
      facebook: (row.facebook as string) || undefined,
    },
    published: Boolean(row.published),
    under18: Boolean(row.under_18),
    guardianApproved: Boolean(row.guardian_approved),
  };
}

function toPublic(row: AmbassadorRecord): Ambassador {
  const { id, userId, under18, guardianApproved, ...card } = row;
  void id;
  void userId;
  void under18;
  void guardianApproved;
  return card;
}

export async function fetchPublishedAmbassadors(): Promise<Ambassador[]> {
  const { data, error } = await supabase.from("ambassadors").select("*").eq("published", true).order("name");
  if (error || !data?.length) {
    return AMBASSADORS.filter((a) => a.published);
  }
  return data.map((row) => toPublic(rowToRecord(row as Record<string, unknown>)));
}

export async function lookupLiveAmbassadorCode(raw: string): Promise<Ambassador | null> {
  const code = raw.trim().toUpperCase();
  if (!code) return null;
  const { data } = await supabase.from("ambassadors").select("*").ilike("code", code).maybeSingle();
  if (data) {
    const rec = rowToRecord(data as Record<string, unknown>);
    return rec.published ? toPublic(rec) : null;
  }
  return AMBASSADORS.find((a) => a.published && a.code === code) ?? null;
}

export async function fetchMyAmbassador(): Promise<AmbassadorRecord | null> {
  const { data: session } = await supabase.auth.getUser();
  if (!session.user) return null;
  const { data, error } = await supabase.from("ambassadors").select("*").eq("user_id", session.user.id).maybeSingle();
  if (error || !data) return null;
  return rowToRecord(data as Record<string, unknown>);
}

export async function saveMyAmbassador(draft: AmbassadorDraft) {
  const { data: session } = await supabase.auth.getUser();
  if (!session.user) throw new Error("Sign in required");
  const existing = await fetchMyAmbassador();
  if (!existing) throw new Error("No ambassador seat is attached to this login yet. Ask the workshop to issue one.");

  const under18 = Boolean(draft.under18 || (draft.ageBand && draft.ageBand !== "18+"));
  const { error } = await supabase
    .from("ambassadors")
    .update({
      name: draft.name.trim(),
      photo: draft.photo?.trim() || null,
      bio: draft.bio.trim(),
      motorsport: draft.motorsport.trim(),
      series: draft.series.trim(),
      class_name: draft.className.trim(),
      team_status: draft.teamStatus.trim(),
      base: draft.base.trim(),
      age_band: draft.ageBand || null,
      crate: draft.crate?.trim() || null,
      instagram: draft.instagram?.trim() || null,
      tiktok: draft.tiktok?.trim() || null,
      youtube: draft.youtube?.trim() || null,
      facebook: draft.facebook?.trim() || null,
      under_18: under18,
      published: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id)
    .eq("user_id", session.user.id);
  if (error) throw new Error(error.message);
  return { ok: true, unpublished: true };
}

export async function staffListAmbassadors(): Promise<AmbassadorRecord[]> {
  const profile = await getProfile();
  if (!profile.isStaff) throw new Error("Staff only");
  const { data, error } = await supabase.from("ambassadors").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => rowToRecord(row as Record<string, unknown>));
}

export async function staffCreateAmbassador(input: {
  name: string;
  code?: string;
  userId?: string;
}) {
  const profile = await getProfile();
  if (!profile.isStaff) throw new Error("Staff only");
  const name = input.name.trim();
  if (!name) throw new Error("Name required");
  const slug = slugify(name);
  const code = (input.code?.trim() || issueCode(name)).toUpperCase();
  const { data, error } = await supabase
    .from("ambassadors")
    .insert({
      slug,
      name,
      code,
      user_id: input.userId || null,
      published: false,
    })
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (input.userId) await promoteAmbassadorRole(input.userId);
  return rowToRecord(data as Record<string, unknown>);
}

export async function staffUpdateAmbassador(
  id: string,
  patch: Partial<AmbassadorDraft> & { published?: boolean; guardianApproved?: boolean; userId?: string | null; code?: string },
) {
  const profile = await getProfile();
  if (!profile.isStaff) throw new Error("Staff only");
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) update.name = patch.name.trim();
  if (patch.photo !== undefined) update.photo = patch.photo.trim() || null;
  if (patch.bio !== undefined) update.bio = patch.bio.trim();
  if (patch.motorsport !== undefined) update.motorsport = patch.motorsport.trim();
  if (patch.series !== undefined) update.series = patch.series.trim();
  if (patch.className !== undefined) update.class_name = patch.className.trim();
  if (patch.teamStatus !== undefined) update.team_status = patch.teamStatus.trim();
  if (patch.base !== undefined) update.base = patch.base.trim();
  if (patch.ageBand !== undefined) update.age_band = patch.ageBand || null;
  if (patch.crate !== undefined) update.crate = patch.crate?.trim() || null;
  if (patch.instagram !== undefined) update.instagram = patch.instagram?.trim() || null;
  if (patch.tiktok !== undefined) update.tiktok = patch.tiktok?.trim() || null;
  if (patch.youtube !== undefined) update.youtube = patch.youtube?.trim() || null;
  if (patch.facebook !== undefined) update.facebook = patch.facebook?.trim() || null;
  if (patch.under18 !== undefined) update.under_18 = patch.under18;
  if (patch.guardianApproved !== undefined) update.guardian_approved = patch.guardianApproved;
  let previousUserId: string | null | undefined;
  if (patch.userId !== undefined) {
    const { data: currentSeat } = await supabase.from("ambassadors").select("user_id").eq("id", id).maybeSingle();
    previousUserId = (currentSeat?.user_id as string) || null;
    update.user_id = patch.userId;
  }
  if (patch.code !== undefined) update.code = patch.code.trim().toUpperCase();
  if (patch.published !== undefined) {
    if (patch.published) {
      const { data: current } = await supabase.from("ambassadors").select("under_18, guardian_approved, name").eq("id", id).maybeSingle();
      if (!current?.name) throw new Error("Name required before publish");
      if (current.under_18 && !current.guardian_approved && patch.guardianApproved !== true) {
        throw new Error("Guardian approval required before publishing an under-18 card");
      }
    }
    update.published = patch.published;
  }
  const { error } = await supabase.from("ambassadors").update(update).eq("id", id);
  if (error) throw new Error(error.message);
  if (previousUserId && previousUserId !== patch.userId) {
    await supabase.from("profiles").update({ role: "customer" }).eq("user_id", previousUserId).eq("role", "ambassador");
  }
  if (patch.userId) await promoteAmbassadorRole(patch.userId);
  return { ok: true };
}

export async function staffAttachAmbassadorLogin(id: string, userId: string | null) {
  return staffUpdateAmbassador(id, { userId });
}

async function promoteAmbassadorRole(userId: string) {
  const { data } = await supabase.from("profiles").select("role").eq("user_id", userId).maybeSingle();
  if (!data) return;
  if (data.role !== "customer" && data.role !== "ambassador") return;
  await supabase.from("profiles").update({ role: "ambassador" }).eq("user_id", userId).in("role", ["customer", "ambassador"]);
}

export function attributedOrdersForCode(orders: ShopOrder[], code: string) {
  return orders.filter((o) => notesHaveAmbassadorCode(o.notes, code) && o.status !== "cancelled");
}

export function commissionBoard(orders: ShopOrder[], rows: AmbassadorRecord[]) {
  return rows.map((row) => {
    const hits = attributedOrdersForCode(orders, row.code);
    const attributedExGst = hits.reduce((n, o) => n + (o.total_ex_gst || 0), 0);
    return {
      code: row.code,
      name: row.name,
      count: hits.length,
      attributedExGst,
      orderIds: hits.map((o) => o.id),
    };
  });
}
