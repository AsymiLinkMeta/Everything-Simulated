import { supabase, supabaseAnonKey, supabaseUrl } from "@/lib/db";
import { BRAND, GUIDES, PACKAGES, RULES } from "./catalog";
import { getCachedProducts, getCachedProductMap } from "./product-cache";
import { checkCart } from "./checkCart";
import type { CartLine, StaffRole } from "./types";

const STAFF: StaffRole[] = ["sales", "workshop", "content", "support", "admin"];

type Profile = { user_id: string; role: string; email: string | null; display_name: string | null };

async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  return user;
}

async function ensureProfile(userId: string, email?: string | null, name?: string | null): Promise<Profile> {
  const { data: existing } = await supabase
    .from("profiles")
    .select("user_id, role, email, display_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) return existing as Profile;

  const { data: allProfiles } = await supabase
    .from("profiles")
    .select("role")
    .eq("role", "admin");
  const role = (allProfiles?.length ?? 0) === 0 ? "admin" : "customer";

  const { data: created } = await supabase
    .from("profiles")
    .insert({ user_id: userId, email: email ?? null, display_name: name ?? null, role })
    .select("user_id, role, email, display_name")
    .maybeSingle();
  return (created ?? { user_id: userId, role, email: email ?? null, display_name: name ?? null }) as Profile;
}

async function getProfileData() {
  const user = await getCurrentUser();
  const row = await ensureProfile(user.id, user.email, user.user_metadata?.display_name);
  return {
    userId: user.id,
    role: row.role as StaffRole,
    isStaff: STAFF.includes(row.role as StaffRole),
  };
}

export async function getProfile() {
  return getProfileData();
}

export async function saveQuote(data: { lines: CartLine[]; postcode?: string; title?: string; driverWeightKg?: number }) {
  const user = await getCurrentUser();
  await ensureProfile(user.id, user.email);
  const result = checkCart({ lines: data.lines, driverWeightKg: data.driverWeightKg });
  const id = `ES-${Date.now().toString(36).toUpperCase()}`;
  const { error } = await supabase.from("quotes").insert({
    id,
    user_id: user.id,
    title: data.title ?? "Custom build",
    status: result.ok ? "quoted" : "draft",
    lines: JSON.stringify(data.lines),
    check_ok: result.ok,
    total_ex_gst: result.totalExGst,
    postcode: data.postcode ?? null,
  });
  if (error) throw new Error(error.message);
  return { id, result };
}

export async function listMyQuotes() {
  const user = await getCurrentUser();
  const { data, error } = await supabase
    .from("quotes")
    .select("id, title, status, total_ex_gst, check_ok, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function requestBooking(data: { kind: string; slot?: string; notes?: string }) {
  const user = await getCurrentUser();
  await ensureProfile(user.id, user.email);
  const { data: row, error } = await supabase
    .from("bookings")
    .insert({ user_id: user.id, kind: data.kind, slot: data.slot ?? null, notes: data.notes ?? "" })
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { id: row?.id };
}

export async function listMyBookings() {
  const user = await getCurrentUser();
  const { data, error } = await supabase
    .from("bookings")
    .select("id, kind, slot, status")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listMyJobs() {
  const user = await getCurrentUser();
  const { data, error } = await supabase
    .from("jobs")
    .select("id, stage, notes, quote_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function requireStaff(userId: string): Promise<StaffRole> {
  const row = await ensureProfile(userId);
  if (!STAFF.includes(row.role as StaffRole)) throw new Error("Staff access required");
  return row.role as StaffRole;
}

export async function staffListQuotes() {
  const user = await getCurrentUser();
  await requireStaff(user.id);
  const { data, error } = await supabase
    .from("quotes")
    .select("id, user_id, title, status, total_ex_gst, check_ok")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function staffListJobs() {
  const user = await getCurrentUser();
  await requireStaff(user.id);
  const { data, error } = await supabase
    .from("jobs")
    .select("id, user_id, stage, notes, quote_id")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function staffListBookings() {
  const user = await getCurrentUser();
  await requireStaff(user.id);
  const { data, error } = await supabase
    .from("bookings")
    .select("id, user_id, kind, slot, status, notes")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function staffSetJobStage(data: { id: number; stage: string }) {
  const user = await getCurrentUser();
  await requireStaff(user.id);
  const { error } = await supabase.from("jobs").update({ stage: data.stage }).eq("id", data.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function staffCreateJob(data: { quoteId?: string; notes?: string }) {
  const user = await getCurrentUser();
  await requireStaff(user.id);
  let owner = user.id;
  if (data.quoteId) {
    const { data: q } = await supabase
      .from("quotes")
      .select("user_id")
      .eq("id", data.quoteId)
      .maybeSingle();
    if (q?.user_id) owner = q.user_id;
  }
  const { data: row, error } = await supabase
    .from("jobs")
    .insert({ user_id: owner, quote_id: data.quoteId ?? null, notes: data.notes ?? "" })
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { id: row?.id };
}

export async function staffSetRole(data: { userId: string; role: StaffRole }) {
  const user = await getCurrentUser();
  const role = await requireStaff(user.id);
  if (role !== "admin") throw new Error("Admin only");
  const { error } = await supabase.from("profiles").update({ role: data.role }).eq("user_id", data.userId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function staffListProfiles() {
  const user = await getCurrentUser();
  const role = await requireStaff(user.id);
  if (role !== "admin") throw new Error("Admin only");
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, email, display_name, role")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function staffOverridePrice(data: { sku: string; sellExGst: number }) {
  const user = await getCurrentUser();
  const role = await requireStaff(user.id);
  if (role !== "admin" && role !== "sales") throw new Error("Not allowed");
  const { error } = await supabase
    .from("product_overrides")
    .upsert({ sku: data.sku, sell_ex_gst: data.sellExGst, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function staffListOverrides() {
  const user = await getCurrentUser();
  await requireStaff(user.id);
  const { data, error } = await supabase
    .from("product_overrides")
    .select("sku, sell_ex_gst, stock_status");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export type CatalogProduct = {
  id: string;
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
  created_by: string;
  created_at: string;
};

export async function staffListCatalogProducts(): Promise<CatalogProduct[]> {
  const user = await getCurrentUser();
  await requireStaff(user.id);
  const { data, error } = await supabase
    .from("catalog_products")
    .select(
      "id, sku, brand, name, category, sell_ex_gst, stock_status, lead_weeks_min, lead_weeks_max, description, notes, created_by, created_at",
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as CatalogProduct[];
}

export async function staffSaveCatalogProduct(input: {
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
}) {
  const user = await getCurrentUser();
  await requireStaff(user.id);
  const { data, error } = await supabase
    .from("catalog_products")
    .insert({
      sku: input.sku,
      brand: input.brand,
      name: input.name,
      category: input.category,
      sell_ex_gst: input.sell_ex_gst,
      stock_status: input.stock_status,
      lead_weeks_min: input.lead_weeks_min,
      lead_weeks_max: input.lead_weeks_max,
      description: input.description,
      notes: input.notes,
    })
    .select("id, sku")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { id: data?.id, sku: data?.sku };
}

export async function staffDeleteCatalogProduct(id: string) {
  const user = await getCurrentUser();
  const role = await requireStaff(user.id);
  if (role !== "admin") throw new Error("Admin only");
  const { error } = await supabase.from("catalog_products").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function askBuilder(data: {
  message: string;
  lines: CartLine[];
  driverWeightKg?: number;
  task?: "chat" | "recommend" | "compatibility";
}) {
  const user = await getCurrentUser();
  await ensureProfile(user.id, user.email);
  await supabase.from("chat_messages").insert({ user_id: user.id, role: "user", content: data.message.slice(0, 4000) });
  const result = checkCart({ lines: data.lines, driverWeightKg: data.driverWeightKg });
  const systemPrompt = `You are the Everything Simulated build agent on the Gold Coast. Phone ${BRAND.phone}. You help customers choose parts, understand compatibility, and prepare accurate quotes. Never invent SKUs, products, prices, stock or lead times. Only recommend these packages: ${PACKAGES.map((p) => p.slug).join(", ")} and catalogue SKUs: ${getCachedProducts().map((p) => p.sku).join(", ")}. Compatibility is decided by the checker JSON — never override a block. Prices are AUD ex GST. If the cart is blocked, explain the exact issue and suggest only fixes supported by the checker. Be concise, practical and premium. Current agent task: ${data.task ?? "chat"}.`;
  const userContent = `Checker JSON: ${JSON.stringify(result)}\nCart: ${JSON.stringify(data.lines)}\nDriver weight kg: ${data.driverWeightKg ?? 80}\nQuestion: ${data.message}`;

  let reply: string;
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) throw new Error("No session");

    const response = await fetch(`${supabaseUrl}/functions/v1/ask-builder`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Apikey: supabaseAnonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ systemPrompt, userContent }),
    });
    if (!response.ok) throw new Error("AI request failed");
    const body = (await response.json()) as { reply?: string };
    reply = body.reply ?? fallbackReply(data.message, result);
  } catch {
    reply = fallbackReply(data.message, result);
  }
  await supabase.from("chat_messages").insert({ user_id: user.id, role: "assistant", content: reply });
  return { reply, result };
}

export async function listChat() {
  const user = await getCurrentUser();
  const { data, error } = await supabase
    .from("chat_messages")
    .select("role, content")
    .eq("user_id", user.id)
    .order("id", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return data ?? [];
}

function fallbackReply(message: string, result: ReturnType<typeof checkCart>) {
  const q = message.toLowerCase();
  if (q.includes("junior") || q.includes("kid") || q.includes("kart")) {
    return "For juniors we spec Starter or Haptic on an adjustable seat, 12Nm unless a coach asks otherwise. Book a Gold Coast demo so pedal spacing is set before the crate leaves. The checker must stay green before deposit.";
  }
  if (q.includes("motion")) {
    return "Motion is the SR2 on Exodus XR1 only — TR120S is blocked. Flagship package is $28,999 + GST. Confirm driver weight so payload stays under 225 kg.";
  }
  if (!result.ok) {
    const block = result.issues.find((i) => i.severity === "block");
    return `This cart is blocked: ${block?.message ?? "conflicting parts"}. Fix that before we quote. ${block?.fix?.join(" ") ?? ""}`;
  }
  if (q.includes("cost") || q.includes("price")) {
    return `This cart is ${Math.round(result.totalExGst / 100)} AUD ex GST (about ${Math.round(result.totalIncGst / 100)} inc GST). Lead time ${result.leadWeeks[0]}–${result.leadWeeks[1]} weeks. Australia-wide crate freight from the Gold Coast.`;
  }
  return `Cart is compatible. Total ${Math.round(result.totalExGst / 100)} AUD ex GST. Save a quote in your account or book a showroom session. Guides covering cost, motion vs haptic, and delivery are on the site.`;
}

export async function publicCatalog() {
  return { products: getCachedProducts(), productMap: getCachedProductMap(), packages: PACKAGES, guides: GUIDES, rules: RULES, brand: BRAND };
}
