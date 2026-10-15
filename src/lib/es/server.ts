import { supabase } from "@/lib/db";
import { getReferralCode } from "./referral";
import { BRAND, GUIDES } from "./catalog";
import { rpcMessage, type ServerQuote } from "./pricing";
import { getCachedProducts, getCachedProductMap, getLiveRules } from "./product-cache";
import { checkCart } from "./checkCart";
import { unwrap } from "./unwrap";
import { freightExGst } from "./freight";
import { livePackages } from "./prebuilds";
import { runBuildAgent } from "./agent";
import type { CartLine, ListingStatus, StaffRole } from "./types";

const STAFF: StaffRole[] = ["sales", "workshop", "content", "support", "admin"];

type Profile = { user_id: string; role: string; email: string | null; display_name: string | null };

async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  return user;
}

async function ensureProfile(userId: string, email?: string | null, name?: string | null): Promise<Profile> {
  const { data: boot, error: bootErr } = await supabase.rpc("bootstrap_profile", {
    p_email: email ?? "",
    p_name: name ?? "",
  });
  if (!bootErr && boot && typeof boot === "object" && (boot as Profile).user_id) {
    return boot as Profile;
  }

  const { data: existing } = await supabase
    .from("profiles")
    .select("user_id, role, email, display_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) return existing as Profile;

  const { data: created } = await supabase
    .from("profiles")
    .insert({ user_id: userId, email: email ?? null, display_name: name ?? null, role: "customer" })
    .select("user_id, role, email, display_name")
    .maybeSingle();
  return (created ?? { user_id: userId, role: "customer", email: email ?? null, display_name: name ?? null }) as Profile;
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

export async function saveQuote(
  input:
    | { lines: CartLine[]; postcode?: string; title?: string; driverWeightKg?: number }
    | { data: { lines: CartLine[]; postcode?: string; title?: string; driverWeightKg?: number } },
) {
  const data = unwrap(input);
  const user = await getCurrentUser();
  await ensureProfile(user.id, user.email);
  const result = checkCart({ lines: data.lines, driverWeightKg: data.driverWeightKg, postcode: data.postcode });
  const id = `ES-${Date.now().toString(36).toUpperCase()}`;
  const { error } = await supabase.from("quotes").insert({
    id,
    user_id: user.id,
    title: data.title ?? "Custom build",
    status: result.ok ? "quoted" : "draft",
    lines: data.lines,
    check_ok: result.ok,
    total_ex_gst: result.totalExGst,
    postcode: data.postcode ?? null,
    // Ambassador attribution travels quote -> order (place_order inherits it).
    referral_code: getReferralCode(),
  });
  if (error) throw new Error(error.message);
  return { id, result };
}

export async function listMyQuotes() {
  const user = await getCurrentUser();
  const { data, error } = await supabase
    .from("quotes")
    .select("id, title, status, total_ex_gst, check_ok, created_at, lines, postcode")
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
    .select("id, stage, notes, quote_id, order_id")
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

export async function staffSetBookingStatus(id: number, status: "requested" | "confirmed" | "cancelled") {
  const user = await getCurrentUser();
  await requireStaff(user.id);
  const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function staffListQuotes() {
  const user = await getCurrentUser();
  await requireStaff(user.id);
  const { data, error } = await supabase
    .from("quotes")
    .select("id, user_id, title, status, total_ex_gst, check_ok, lines, created_at, postcode")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    ...row,
    lines: Array.isArray(row.lines) ? (row.lines as CartLine[]) : [],
  }));
}

export async function staffListJobs() {
  const user = await getCurrentUser();
  await requireStaff(user.id);
  const { data, error } = await supabase
    .from("jobs")
    .select("id, user_id, stage, notes, quote_id, order_id")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const ids = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: profiles } = await supabase.from("profiles").select("user_id, display_name, email").in("user_id", ids);
    for (const p of profiles ?? []) {
      names.set(p.user_id, p.display_name || p.email || p.user_id.slice(0, 8));
    }
  }
  return rows.map((r) => ({ ...r, customer: names.get(r.user_id) || r.user_id?.slice(0, 8) || "Guest" }));
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
  const rows = data ?? [];
  const ids = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: profiles } = await supabase.from("profiles").select("user_id, display_name, email").in("user_id", ids);
    for (const p of profiles ?? []) {
      names.set(p.user_id, p.display_name || p.email || p.user_id.slice(0, 8));
    }
  }
  return rows.map((r) => ({ ...r, customer: names.get(r.user_id) || r.user_id?.slice(0, 8) || "Customer" }));
}

export async function staffSetJobStage(data: { id: number; stage: string }) {
  const user = await getCurrentUser();
  await requireStaff(user.id);
  const { error } = await supabase.from("jobs").update({ stage: data.stage }).eq("id", data.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function staffSetJobNotes(id: number, notes: string) {
  const user = await getCurrentUser();
  await requireStaff(user.id);
  const { error } = await supabase.from("jobs").update({ notes }).eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function staffCreateQuote(input: {
  lines: CartLine[];
  title?: string;
  contactId?: string;
  driverWeightKg?: number;
  postcode?: string;
}) {
  const user = await getCurrentUser();
  await requireStaff(user.id);
  const lines = input.lines.filter((l) => l.sku && l.qty > 0);
  if (!lines.length) throw new Error("Quote needs at least one part");
  const result = checkCart({ lines, driverWeightKg: input.driverWeightKg, postcode: input.postcode });
  const id = `ES-${Date.now().toString(36).toUpperCase()}`;
  let owner = user.id;
  let postcode = input.postcode ?? null;
  if (input.contactId) {
    const { data: c } = await supabase
      .from("crm_contacts")
      .select("user_id, postcode, display_name")
      .eq("id", input.contactId)
      .maybeSingle();
    if (c?.user_id) owner = c.user_id;
    if (!postcode && c?.postcode) postcode = c.postcode;
  }
  const row: Record<string, unknown> = {
    id,
    user_id: owner,
    title: input.title?.trim() || "Workshop spec",
    status: result.ok ? "quoted" : "draft",
    lines,
    check_ok: result.ok,
    total_ex_gst: result.totalExGst,
    postcode,
  };
  if (input.contactId) row.contact_id = input.contactId;
  let { error } = await supabase.from("quotes").insert(row);
  if (error && input.contactId) {
    delete row.contact_id;
    ({ error } = await supabase.from("quotes").insert(row));
  }
  if (error && owner !== user.id) {
    row.user_id = user.id;
    ({ error } = await supabase.from("quotes").insert(row));
  }
  if (error) throw new Error(error.message);
  if (input.contactId) {
    await supabase.from("crm_contacts").update({ crm_stage: "quoted", updated_at: new Date().toISOString() }).eq("id", input.contactId);
    await supabase.from("crm_notes").insert({
      contact_id: input.contactId,
      actor_id: user.id,
      kind: "note",
      body: `Quote ${id} · ${row.title} · ${result.ok ? "checker clear" : "checker blocked"}`,
    });
  }
  return { id, result };
}

export async function staffCreateJob(data: { quoteId?: string; notes?: string }) {
  const user = await getCurrentUser();
  await requireStaff(user.id);
  let owner = user.id;
  if (data.quoteId) {
    const { data: q } = await supabase.from("quotes").select("user_id").eq("id", data.quoteId).maybeSingle();
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
  if (data.userId === user.id && data.role !== "admin") {
    const { data: admins } = await supabase.from("profiles").select("user_id").eq("role", "admin");
    if ((admins?.length ?? 0) <= 1) throw new Error("Cannot demote the last admin");
  }
  const { error } = await supabase.from("profiles").update({ role: data.role }).eq("user_id", data.userId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function staffListProfiles() {
  const user = await getCurrentUser();
  await requireStaff(user.id);
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
  const now = new Date().toISOString();
  await supabase.from("catalog_products").update({ sell_ex_gst: data.sellExGst, updated_at: now }).eq("sku", data.sku);
  const { error } = await supabase
    .from("product_overrides")
    .upsert({ sku: data.sku, sell_ex_gst: data.sellExGst, updated_at: now });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function staffListOverrides() {
  const user = await getCurrentUser();
  await requireStaff(user.id);
  const { data, error } = await supabase.from("product_overrides").select("sku, sell_ex_gst, stock_status");
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
  cost_ex_gst?: number;
  stock_status: string;
  listing_status: ListingStatus;
  qty_on_hand: number;
  lead_weeks_min: number;
  lead_weeks_max: number;
  description: string;
  notes: string;
  image_url: string | null;
  images: string[];
  manufacturer_url: string | null;
  whats_included: string[] | null;
  mount_compatibility: string | null;
  assembly_manual_url: string | null;
  specs: Record<string, string> | null;
  compare: string | null;
  max_nm?: number | null;
  payload_kg?: number | null;
  weight_kg?: number | null;
  mounts?: string[] | null;
  qr?: string | null;
  created_by: string;
  created_at: string;
  enquiry_only?: boolean;
  /** Override if set, else sell_ex_gst. What customers are charged. */
  effective_price_ex_gst?: number;
  override_ex_gst?: number | null;
  purchasable?: boolean;
};

export async function staffListCatalogProducts(): Promise<CatalogProduct[]> {
  const user = await getCurrentUser();
  await requireStaff(user.id);
  const { data, error } = await supabase
    .from("catalog_products")
    .select(
      "id, sku, brand, name, category, sell_ex_gst, cost_ex_gst, stock_status, listing_status, qty_on_hand, lead_weeks_min, lead_weeks_max, description, notes, image_url, images, manufacturer_url, whats_included, mount_compatibility, assembly_manual_url, specs, compare, max_nm, payload_kg, weight_kg, mounts, qr, created_by, created_at, enquiry_only",
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const { data: prices, error: pricesErr } = await supabase
    .from("catalog_prices")
    .select("sku, price_ex_gst, override_ex_gst, purchasable");
  if (pricesErr) throw new Error(pricesErr.message);
  const priceBySku = new Map((prices ?? []).map((p) => [p.sku as string, p]));
  return (data ?? []).map((row) => ({
    ...(row as CatalogProduct),
    effective_price_ex_gst: Number(priceBySku.get((row as CatalogProduct).sku)?.price_ex_gst ?? (row as CatalogProduct).sell_ex_gst) || 0,
    override_ex_gst: (priceBySku.get((row as CatalogProduct).sku)?.override_ex_gst as number | null | undefined) ?? null,
    purchasable: Boolean(priceBySku.get((row as CatalogProduct).sku)?.purchasable),
    listing_status: (((row as CatalogProduct).listing_status || "published") as ListingStatus),
    qty_on_hand: Number((row as CatalogProduct).qty_on_hand) || 0,
    images: Array.isArray((row as CatalogProduct).images) ? (row as CatalogProduct).images : [],
  }));
}

export async function staffSaveCatalogProduct(input: {
  sku: string;
  brand: string;
  name: string;
  category: string;
  sell_ex_gst: number;
  cost_ex_gst?: number;
  stock_status: string;
  listing_status?: ListingStatus;
  qty_on_hand?: number;
  lead_weeks_min: number;
  lead_weeks_max: number;
  description: string;
  notes: string;
  image_url?: string | null;
  images?: string[];
  manufacturer_url?: string | null;
  whats_included?: string[];
  mount_compatibility?: string;
  assembly_manual_url?: string | null;
  specs?: Record<string, string>;
  compare?: string;
  max_nm?: number | null;
  payload_kg?: number | null;
  weight_kg?: number | null;
  mounts?: string[];
  qr?: string | null;
  enquiry_only?: boolean;
}) {
  const user = await getCurrentUser();
  await requireStaff(user.id);
  const images = (input.images ?? []).filter(Boolean).slice(0, 8);
  const listing_status = input.listing_status ?? "draft";
  const row = {
    sku: input.sku.trim(),
    brand: input.brand,
    name: input.name,
    category: input.category,
    sell_ex_gst: input.sell_ex_gst,
    cost_ex_gst: input.cost_ex_gst ?? 0,
    stock_status: input.stock_status,
    listing_status,
    qty_on_hand: input.qty_on_hand ?? 0,
    lead_weeks_min: input.lead_weeks_min,
    lead_weeks_max: input.lead_weeks_max,
    description: input.description,
    notes: input.notes,
    image_url: input.image_url || images[0] || null,
    image: input.image_url || images[0] || null,
    images,
    manufacturer_url: input.manufacturer_url || null,
    whats_included: input.whats_included ?? [],
    mount_compatibility: input.mount_compatibility ?? "",
    assembly_manual_url: input.assembly_manual_url ?? null,
    specs: input.specs ?? {},
    compare: input.compare ?? "",
    max_nm: input.max_nm ?? null,
    payload_kg: input.payload_kg ?? null,
    weight_kg: input.weight_kg ?? null,
    mounts: input.mounts ?? [],
    qr: input.qr ?? null,
    ...(input.enquiry_only === undefined ? {} : { enquiry_only: input.enquiry_only }),
    updated_at: new Date().toISOString(),
    created_by: user.id,
  };
  const { data, error } = await supabase
    .from("catalog_products")
    .upsert(row, { onConflict: "sku" })
    .select("id, sku")
    .maybeSingle();
  if (error) throw new Error(friendlyGuard(error.message));
  if (listing_status === "published" && row.sell_ex_gst > 0) {
    await supabase.from("product_overrides").upsert({
      sku: row.sku,
      sell_ex_gst: row.sell_ex_gst,
      stock_status: row.stock_status,
      updated_at: row.updated_at,
    });
  }
  return { id: data?.id, sku: data?.sku, listing_status };
}

export async function staffDeleteCatalogProduct(id: string) {
  const user = await getCurrentUser();
  const role = await requireStaff(user.id);
  if (role !== "admin") throw new Error("Admin only");
  const { error } = await supabase.from("catalog_products").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

/** Publish guard messages from the database read fine as they are; strip the Postgres prefix. */
function friendlyGuard(message: string) {
  return message.replace(/^.*?ERROR:\s*/i, "");
}

export async function staffSetListingStatus(sku: string, listing_status: ListingStatus) {
  const user = await getCurrentUser();
  await requireStaff(user.id);
  const { error } = await supabase
    .from("catalog_products")
    .update({ listing_status, updated_at: new Date().toISOString() })
    .eq("sku", sku);
  // The guard_catalog_publish trigger refuses to publish at $0 unless enquiry-only.
  if (error) throw new Error(friendlyGuard(error.message));
  return { ok: true };
}

/** Enquiry-only products show "Enquire for price" and can't be added to a cart. */
export async function staffSetEnquiryOnly(sku: string, enquiry_only: boolean) {
  const user = await getCurrentUser();
  await requireStaff(user.id);
  const { error } = await supabase
    .from("catalog_products")
    .update({ enquiry_only, updated_at: new Date().toISOString() })
    .eq("sku", sku);
  if (error) throw new Error(friendlyGuard(error.message));
  return { ok: true };
}

export async function listMyOrders() {
  const user = await getCurrentUser();
  const { data, error } = await supabase
    .from("shop_orders")
    .select("id, status, total_ex_gst, total_inc_gst, tracking_number, carrier, invoice_number, created_at, lines")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export type PlaceOrderInput = {
  lines: CartLine[];
  postcode?: string;
  notes?: string;
  driverWeightKg?: number;
  quoteId?: string;
  prebuild?: string | null;
  referralCode?: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
};

/**
 * Place an order through the place_order() RPC. The browser sends SKUs and
 * quantities only: prices, freight, GST, the CRM contact, the job card and the
 * referral are all worked out in the database.
 */
async function callPlaceOrder(input: PlaceOrderInput) {
  const lines = (input.lines ?? []).filter((l) => l.sku && l.qty > 0);
  if (!lines.length) throw new Error("Cart is empty");
  const { data, error } = await supabase.rpc("place_order", {
    p: {
      lines: lines.map((l) => ({ sku: l.sku, qty: l.qty })),
      postcode: input.postcode ?? null,
      notes: input.notes ?? "",
      driver_kg: input.driverWeightKg ?? null,
      quote_id: input.quoteId ?? null,
      prebuild: input.prebuild ?? null,
      referral_code: input.referralCode ?? null,
      name: input.name ?? "",
      email: input.email ?? null,
      phone: input.phone ?? null,
      address: input.address ?? null,
    },
  });
  if (error) throw new Error(rpcMessage(error));
  const res = data as { id: string; referral_code: string | null; quote: ServerQuote };
  return { id: res.id, quote: res.quote, referralCode: res.referral_code };
}

export async function placeOrder(input: PlaceOrderInput | { data: PlaceOrderInput }) {
  const data = unwrap(input);
  const user = await getCurrentUser();
  await ensureProfile(user.id, user.email, data.name || user.user_metadata?.display_name);
  const res = await callPlaceOrder(data);
  if (res.quote?.ok) {
    void supabase.rpc("record_agent_memory", {
      p_kind: "won_bom",
      p_title: `Won ${res.id}`,
      p_body: data.lines.map((l) => `${l.qty}× ${l.sku}`).join(", "),
      p_payload: { orderId: res.id, lines: data.lines, totalExGst: res.quote.total_ex_gst },
      p_source: "system",
    });
  }
  return res;
}

export async function askBuilder(data: {
  message: string;
  lines: CartLine[];
  driverWeightKg?: number;
  task?: "chat" | "recommend" | "compatibility";
}) {
  await ensureProfile((await getCurrentUser()).id);
  const turn = await runBuildAgent({
    message: data.message,
    lines: data.lines,
    driverWeightKg: data.driverWeightKg,
    task: data.task ?? "chat",
  });
  return {
    reply: turn.reply,
    result: turn.result,
    proposedLines: turn.proposedLines,
    proposedCheck: turn.proposedCheck,
  };
}

export async function listChat() {
  const user = await getCurrentUser();
  const { data, error } = await supabase
    .from("chat_messages")
    .select("role, content, created_at, id")
    .eq("user_id", user.id)
    .order("id", { ascending: false })
    .limit(80);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function publicCatalog() {
  return {
    products: getCachedProducts(),
    productMap: getCachedProductMap(),
    packages: livePackages(),
    guides: GUIDES,
    rules: getLiveRules(),
    brand: BRAND,
    seed: getCachedProducts(),
  };
}

export async function placeGuestOrder(input: PlaceOrderInput & { name: string; email: string }) {
  if (!input.name.trim()) throw new Error("Name is required");
  if (!input.email.trim()) throw new Error("Email is required");
  return callPlaceOrder(input);
}

export { freightExGst };
