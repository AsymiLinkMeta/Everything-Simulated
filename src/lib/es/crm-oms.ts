import { supabase } from "@/lib/db";
import { getCachedProducts } from "./product-cache";
import { checkCart } from "./checkCart";
import type { CartLine } from "./types";

export const CRM_STAGES = ["lead", "qualified", "quoted", "won", "active", "dormant"] as const;
export type CrmStage = (typeof CRM_STAGES)[number];
export const CRM_STAGE_LABELS: Record<CrmStage, string> = {
  lead: "Lead",
  qualified: "Qualified",
  quoted: "Quoted",
  won: "Won",
  active: "Active",
  dormant: "Dormant",
};
export const CRM_SOURCES = ["website", "studio", "phone", "instagram", "referral", "walk-in", "other"] as const;
export const CRM_NOTE_KINDS = ["note", "call", "email", "visit", "follow_up"] as const;
export type CrmNoteKind = (typeof CRM_NOTE_KINDS)[number];
export const ORDER_STATUSES = ["pending", "paid", "packing", "shipped", "delivered", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type CrmContact = {
  id: string;
  user_id: string | null;
  display_name: string;
  email: string | null;
  phone: string | null;
  postcode: string | null;
  address: string | null;
  crm_stage: CrmStage;
  crm_source: string | null;
  crm_owner_id: string | null;
  follow_up_at: string | null;
  tags: string[];
  notes: string;
  created_at: string;
};

export type CrmNote = {
  id: number;
  contact_id: string;
  actor_id: string;
  kind: string;
  body: string;
  created_at: string;
};

export type ShopOrder = {
  id: string;
  contact_id: string | null;
  user_id: string | null;
  quote_id: string | null;
  status: OrderStatus;
  lines: CartLine[];
  total_ex_gst: number;
  total_inc_gst: number;
  shipping_name: string | null;
  shipping_address: string | null;
  postcode: string | null;
  tracking_number: string | null;
  carrier: string;
  invoice_number: string | null;
  notes: string;
  return_reason: string | null;
  packed_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  created_at: string;
  contact_name?: string | null;
};

function asTags(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean).slice(0, 12);
  return [];
}

function asLines(raw: unknown): CartLine[] {
  if (typeof raw === "string") {
    try {
      return asLines(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .map((l) => ({ sku: String((l as CartLine).sku ?? ""), qty: Math.max(0, Number((l as CartLine).qty) || 0) }))
    .filter((l) => l.sku && l.qty > 0);
}

async function adjustStock(lines: CartLine[], sign: 1 | -1) {
  for (const line of lines) {
    const { data } = await supabase
      .from("catalog_products")
      .select("qty_on_hand, stock_status")
      .eq("sku", line.sku)
      .maybeSingle();
    if (!data) continue;
    const next = Math.max(0, Number(data.qty_on_hand ?? 0) + sign * line.qty);
    const stock_status = next <= 0 && data.stock_status === "stock" ? "indent" : data.stock_status;
    await supabase.from("catalog_products").update({ qty_on_hand: next, stock_status }).eq("sku", line.sku);
  }
}

function shapeContact(row: Record<string, unknown>): CrmContact {
  return {
    id: String(row.id),
    user_id: (row.user_id as string) ?? null,
    display_name: String(row.display_name ?? ""),
    email: (row.email as string) ?? null,
    phone: (row.phone as string) ?? null,
    postcode: (row.postcode as string) ?? null,
    address: (row.address as string) ?? null,
    crm_stage: (CRM_STAGES.includes(row.crm_stage as CrmStage) ? row.crm_stage : "lead") as CrmStage,
    crm_source: (row.crm_source as string) ?? null,
    crm_owner_id: (row.crm_owner_id as string) ?? null,
    follow_up_at: row.follow_up_at ? String(row.follow_up_at).slice(0, 10) : null,
    tags: asTags(row.tags),
    notes: String(row.notes ?? ""),
    created_at: String(row.created_at ?? ""),
  };
}

function shapeOrder(row: Record<string, unknown>, contactName?: string | null): ShopOrder {
  return {
    id: String(row.id),
    contact_id: (row.contact_id as string) ?? null,
    user_id: (row.user_id as string) ?? null,
    quote_id: (row.quote_id as string) ?? null,
    status: (ORDER_STATUSES.includes(row.status as OrderStatus) ? row.status : "pending") as OrderStatus,
    lines: asLines(row.lines),
    total_ex_gst: Number(row.total_ex_gst) || 0,
    total_inc_gst: Number(row.total_inc_gst) || 0,
    shipping_name: (row.shipping_name as string) ?? null,
    shipping_address: (row.shipping_address as string) ?? null,
    postcode: (row.postcode as string) ?? null,
    tracking_number: (row.tracking_number as string) ?? null,
    carrier: String(row.carrier ?? "ES Crate Freight"),
    invoice_number: (row.invoice_number as string) ?? null,
    notes: String(row.notes ?? ""),
    return_reason: (row.return_reason as string) ?? null,
    packed_at: (row.packed_at as string) ?? null,
    shipped_at: (row.shipped_at as string) ?? null,
    delivered_at: (row.delivered_at as string) ?? null,
    created_at: String(row.created_at ?? ""),
    contact_name: contactName ?? null,
  };
}

async function requireStaffId() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data: profile } = await supabase.from("profiles").select("role").eq("user_id", user.id).maybeSingle();
  if (!profile || !["sales", "workshop", "content", "support", "admin"].includes(profile.role)) {
    throw new Error("Staff access required");
  }
  return user.id;
}

export async function staffListContacts(): Promise<CrmContact[]> {
  await requireStaffId();
  const { data, error } = await supabase.from("crm_contacts").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => shapeContact(row as Record<string, unknown>));
}

export async function staffGetContact(id: string) {
  await requireStaffId();
  const { data, error } = await supabase.from("crm_contacts").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const notes = await supabase
    .from("crm_notes")
    .select("id, contact_id, actor_id, kind, body, created_at")
    .eq("contact_id", id)
    .order("created_at", { ascending: false })
    .limit(40);
  const orders = await supabase
    .from("shop_orders")
    .select("*")
    .eq("contact_id", id)
    .order("created_at", { ascending: false });
  return {
    contact: shapeContact(data as Record<string, unknown>),
    notes: (notes.data ?? []) as CrmNote[],
    orders: (orders.data ?? []).map((row) => shapeOrder(row as Record<string, unknown>, data.display_name)),
  };
}

export async function staffCreateContact(input: {
  displayName: string;
  email?: string;
  phone?: string;
  postcode?: string;
  address?: string;
  notes?: string;
  crmSource?: string;
}) {
  const actor = await requireStaffId();
  const name = input.displayName.trim();
  if (!name) throw new Error("Name required");
  const { data, error } = await supabase
    .from("crm_contacts")
    .insert({
      display_name: name,
      email: input.email?.trim().toLowerCase() || null,
      phone: input.phone?.trim() || null,
      postcode: input.postcode?.trim() || null,
      address: input.address?.trim() || null,
      notes: input.notes?.trim() || "",
      crm_stage: "lead",
      crm_source: input.crmSource || "website",
      crm_owner_id: actor,
    })
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return shapeContact(data as Record<string, unknown>);
}

export async function staffUpdateContact(id: string, patch: Partial<CrmContact> & { tags?: string[] }) {
  await requireStaffId();
  const { error } = await supabase
    .from("crm_contacts")
    .update({
      display_name: patch.display_name,
      email: patch.email,
      phone: patch.phone,
      postcode: patch.postcode,
      address: patch.address,
      notes: patch.notes,
      crm_source: patch.crm_source,
      crm_owner_id: patch.crm_owner_id,
      follow_up_at: patch.follow_up_at || null,
      tags: patch.tags ?? [],
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function staffSetContactStage(id: string, stage: CrmStage) {
  await requireStaffId();
  const { error } = await supabase
    .from("crm_contacts")
    .update({ crm_stage: stage, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function staffLogContactNote(id: string, kind: CrmNoteKind, body: string) {
  const actor = await requireStaffId();
  const text = body.trim();
  if (!text) throw new Error("Note required");
  const { error } = await supabase.from("crm_notes").insert({
    contact_id: id,
    actor_id: actor,
    kind,
    body: text,
  });
  if (error) throw new Error(error.message);
  if (kind === "follow_up") {
    const next = new Date();
    next.setDate(next.getDate() + 7);
    await supabase
      .from("crm_contacts")
      .update({ follow_up_at: next.toISOString().slice(0, 10), updated_at: new Date().toISOString() })
      .eq("id", id);
  }
  return { ok: true };
}

export async function staffListOrders(): Promise<ShopOrder[]> {
  await requireStaffId();
  const { data, error } = await supabase.from("shop_orders").select("*").order("created_at", { ascending: false }).limit(100);
  if (error) throw new Error(error.message);
  const contacts = await supabase.from("crm_contacts").select("id, display_name");
  const names = Object.fromEntries((contacts.data ?? []).map((c) => [c.id, c.display_name]));
  return (data ?? []).map((row) =>
    shapeOrder(row as Record<string, unknown>, row.contact_id ? names[row.contact_id as string] : null),
  );
}

export async function staffGetOrder(id: string) {
  await requireStaffId();
  const { data, error } = await supabase.from("shop_orders").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  let name: string | null = null;
  if (data.contact_id) {
    const { data: c } = await supabase.from("crm_contacts").select("display_name").eq("id", data.contact_id).maybeSingle();
    name = c?.display_name ?? null;
  }
  return shapeOrder(data as Record<string, unknown>, name);
}

export async function staffCreateOrder(input: {
  contactId: string;
  quoteId?: string;
  lines?: CartLine[];
  notes?: string;
}) {
  await requireStaffId();
  let lines = (input.lines ?? []).filter((l) => l.sku && l.qty > 0);
  if (input.quoteId && !lines.length) {
    const { data: q } = await supabase.from("quotes").select("lines, user_id").eq("id", input.quoteId).maybeSingle();
    lines = asLines(q?.lines);
  }
  if (!lines.length) throw new Error("Order needs at least one line");
  const result = checkCart({ lines });
  const { data: contact } = await supabase.from("crm_contacts").select("*").eq("id", input.contactId).maybeSingle();
  if (!contact) throw new Error("Pick a customer");
  const id = `ESO-${Date.now().toString(36).toUpperCase()}`;
  const status: OrderStatus = "pending";
  const { error } = await supabase.from("shop_orders").insert({
    id,
    contact_id: input.contactId,
    user_id: contact.user_id,
    quote_id: input.quoteId ?? null,
    status,
    lines,
    total_ex_gst: result.totalExGst,
    total_inc_gst: result.totalIncGst,
    shipping_name: contact.display_name,
    shipping_address: contact.address,
    postcode: contact.postcode,
    notes: input.notes ?? "",
    invoice_number: null,
  });
  if (error) throw new Error(error.message);
  await supabase.from("crm_contacts").update({ crm_stage: "quoted" }).eq("id", input.contactId);
  if (input.quoteId) {
    await supabase.from("quotes").update({ status: "converted", updated_at: new Date().toISOString() }).eq("id", input.quoteId);
  }
  return { id, result };
}

export async function staffConvertQuote(quoteId: string) {
  const actor = await requireStaffId();
  const { data: q, error } = await supabase.from("quotes").select("*").eq("id", quoteId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!q) throw new Error("Quote not found");
  const lines = asLines(q.lines);
  if (!lines.length) throw new Error("Quote has no parts");

  let contactId: string | null = null;
  const { data: byUser } = await supabase.from("crm_contacts").select("id").eq("user_id", q.user_id).limit(1);
  if (byUser?.[0]?.id) contactId = byUser[0].id as string;
  else {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, display_name")
      .eq("user_id", q.user_id)
      .maybeSingle();
    const { data: created, error: createErr } = await supabase
      .from("crm_contacts")
      .insert({
        user_id: q.user_id,
        display_name: profile?.display_name || q.title || "Customer",
        email: profile?.email ?? null,
        crm_stage: "quoted",
        crm_source: "website",
      })
      .select("id")
      .maybeSingle();
    if (createErr) throw new Error(createErr.message);
    contactId = created?.id ?? null;
  }
  if (!contactId) throw new Error("Could not attach a customer");

  const order = await staffCreateOrder({
    contactId,
    quoteId,
    lines,
    notes: `Converted from quote ${quoteId}`,
  });

  await supabase.from("jobs").insert({
    user_id: q.user_id,
    quote_id: quoteId,
    order_id: order.id,
    stage: "enquiry",
    notes: `From quote ${quoteId} / order ${order.id}`,
  });

  void actor;
  return { orderId: order.id };
}

export type StaffAlert = {
  id: string;
  kind: string;
  title: string;
  body: string;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

export async function staffListAlerts(): Promise<StaffAlert[]> {
  await requireStaffId();
  const { data, error } = await supabase
    .from("staff_alerts")
    .select("id, kind, title, body, href, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  return (data ?? []) as StaffAlert[];
}

export async function staffMarkAlertRead(id: string) {
  await requireStaffId();
  const { error } = await supabase.from("staff_alerts").update({ read_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function staffSetOrderStatus(id: string, status: OrderStatus) {
  const actor = await requireStaffId();
  const { data: current } = await supabase
    .from("shop_orders")
    .select("status, packed_at, lines, contact_id")
    .eq("id", id)
    .maybeSingle();
  if (!current) throw new Error("Order not found");
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "packing") patch.packed_at = new Date().toISOString();
  if (status === "shipped") patch.shipped_at = new Date().toISOString();
  if (status === "delivered") patch.delivered_at = new Date().toISOString();
  if (status === "paid") patch.invoice_number = `ESI-${Date.now().toString(36).toUpperCase()}`;
  const { error } = await supabase.from("shop_orders").update(patch).eq("id", id);
  if (error) throw new Error(error.message);

  const lines = asLines(current.lines);
  const wasPicked = Boolean(current.packed_at) || current.status === "packing" || current.status === "shipped";
  const willPick = status === "packing" || status === "shipped" || status === "delivered";
  if (!wasPicked && willPick) await adjustStock(lines, -1);
  if (wasPicked && (status === "cancelled" || status === "pending")) await adjustStock(lines, 1);

  if (status === "delivered" && current.contact_id) {
    await supabase.from("crm_contacts").update({ crm_stage: "active" }).eq("id", current.contact_id);
  }
  void actor;
  return { ok: true };
}

export async function staffAssignTracking(id: string, tracking?: string, carrier?: string) {
  await requireStaffId();
  const number =
    tracking?.trim() ||
    `ES${new Date().toISOString().slice(2, 10).replaceAll("-", "")}${Math.random().toString(36).slice(2, 6).toUpperCase()}AU`;
  const { data: current } = await supabase.from("shop_orders").select("status").eq("id", id).maybeSingle();
  const next = current?.status === "pending" || current?.status === "paid" ? "shipped" : current?.status;
  const { error } = await supabase
    .from("shop_orders")
    .update({
      tracking_number: number,
      carrier: carrier?.trim() || "ES Crate Freight",
      status: next,
      shipped_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return { tracking: number };
}

export async function staffUpdateOrderShipping(
  id: string,
  patch: { shipping_name?: string; shipping_address?: string; postcode?: string; notes?: string; lines?: CartLine[] },
) {
  await requireStaffId();
  const update: Record<string, unknown> = {
    shipping_name: patch.shipping_name,
    shipping_address: patch.shipping_address,
    postcode: patch.postcode,
    notes: patch.notes,
    updated_at: new Date().toISOString(),
  };
  if (patch.lines) {
    const result = checkCart({ lines: patch.lines });
    update.lines = patch.lines;
    update.total_ex_gst = result.totalExGst;
    update.total_inc_gst = result.totalIncGst;
  }
  const { error } = await supabase.from("shop_orders").update(update).eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function staffReturnOrder(id: string, reason: string) {
  await requireStaffId();
  if (!reason.trim()) throw new Error("Return reason required");
  const { data: current } = await supabase.from("shop_orders").select("status, packed_at, lines").eq("id", id).maybeSingle();
  const { error } = await supabase
    .from("shop_orders")
    .update({
      status: "cancelled",
      return_reason: reason.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  const wasPicked = Boolean(current?.packed_at) || current?.status === "packing" || current?.status === "shipped";
  if (wasPicked) await adjustStock(asLines(current?.lines), 1);
  return { ok: true };
}

export function orderTone(status: string): "ok" | "warn" | "bad" | undefined {
  if (status === "delivered" || status === "paid") return "ok";
  if (status === "cancelled") return "bad";
  if (status === "packing" || status === "shipped" || status === "pending") return "warn";
  return undefined;
}

export function catalogSkuOptions() {
  return getCachedProducts().map((p) => ({ sku: p.sku, label: `${p.sku} · ${p.brand} ${p.name}`, price: p.sellExGst }));
}
