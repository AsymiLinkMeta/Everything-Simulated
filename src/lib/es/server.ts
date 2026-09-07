import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { adminClient } from "@/lib/db";
import { BRAND, GUIDES, PACKAGES, PRODUCT_MAP, PRODUCTS, RULES } from "./catalog";
import { checkCart } from "./checkCart";
import type { CartLine, StaffRole } from "./types";

const STAFF: StaffRole[] = ["sales", "workshop", "content", "support", "admin"];

async function ensureProfile(userId: string, email?: string | null, name?: string | null) {
  const { data: existing } = await adminClient
    .from("profiles")
    .select("user_id, role")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return existing as { user_id: string; role: string };

  const { count } = await adminClient
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("role", "admin");

  const role = (count ?? 0) === 0 ? "admin" : "customer";

  const { data: inserted } = await adminClient
    .from("profiles")
    .insert({ user_id: userId, email: email ?? null, display_name: name ?? null, role })
    .select("user_id, role")
    .single();

  return inserted as { user_id: string; role: string };
}

export const getProfile = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const ctx = context!;
    const row = await ensureProfile(ctx.userId);
    return {
      userId: ctx.userId,
      role: row.role as StaffRole,
      isStaff: STAFF.includes(row.role as StaffRole),
    };
  });

export const saveQuote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { lines: CartLine[]; postcode?: string; title?: string }) => d)
  .handler(async ({ context, data }) => {
    const ctx = context!;
    await ensureProfile(ctx.userId);
    const result = checkCart({ lines: data.lines });
    const id = `ES-${Date.now().toString(36).toUpperCase()}`;

    const { error } = await adminClient.from("quotes").insert({
      id,
      user_id: ctx.userId,
      title: data.title ?? "Custom build",
      status: result.ok ? "quoted" : "draft",
      lines: data.lines,
      check_ok: result.ok,
      total_ex_gst: result.totalExGst,
      postcode: data.postcode ?? null,
    });

    if (error) throw new Error(error.message);
    return { id, result };
  });

export const listMyQuotes = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const ctx = context!;
    const { data, error } = await adminClient
      .from("quotes")
      .select("id, title, status, total_ex_gst, check_ok, created_at")
      .eq("user_id", ctx.userId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const requestBooking = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { kind: string; slot?: string; notes?: string }) => d)
  .handler(async ({ context, data }) => {
    const ctx = context!;
    await ensureProfile(ctx.userId);
    const { data: inserted, error } = await adminClient
      .from("bookings")
      .insert({
        user_id: ctx.userId,
        kind: data.kind,
        slot: data.slot ?? null,
        notes: data.notes ?? "",
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return { id: inserted?.id };
  });

export const listMyBookings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const ctx = context!;
    const { data, error } = await adminClient
      .from("bookings")
      .select("id, kind, slot, status")
      .eq("user_id", ctx.userId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listMyJobs = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const ctx = context!;
    const { data, error } = await adminClient
      .from("jobs")
      .select("id, stage, notes, quote_id")
      .eq("user_id", ctx.userId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data ?? [];
  });

async function requireStaff(userId: string) {
  const row = await ensureProfile(userId);
  if (!STAFF.includes(row.role as StaffRole)) {
    throw new Error("Staff access required");
  }
  return row.role as StaffRole;
}

export const staffListQuotes = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const ctx = context!;
    await requireStaff(ctx.userId);
    const { data, error } = await adminClient
      .from("quotes")
      .select("id, user_id, title, status, total_ex_gst, check_ok")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const staffListJobs = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const ctx = context!;
    await requireStaff(ctx.userId);
    const { data, error } = await adminClient
      .from("jobs")
      .select("id, user_id, stage, notes, quote_id")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const staffListBookings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const ctx = context!;
    await requireStaff(ctx.userId);
    const { data, error } = await adminClient
      .from("bookings")
      .select("id, user_id, kind, slot, status, notes")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const staffSetJobStage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: number; stage: string }) => d)
  .handler(async ({ context, data }) => {
    const ctx = context!;
    await requireStaff(ctx.userId);
    const { error } = await adminClient
      .from("jobs")
      .update({ stage: data.stage })
      .eq("id", data.id);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const staffCreateJob = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { quoteId?: string; notes?: string }) => d)
  .handler(async ({ context, data }) => {
    const ctx = context!;
    await requireStaff(ctx.userId);

    let owner = ctx.userId;
    if (data.quoteId) {
      const { data: q } = await adminClient
        .from("quotes")
        .select("user_id")
        .eq("id", data.quoteId)
        .maybeSingle();
      if (q?.user_id) owner = q.user_id;
    }

    const { data: inserted, error } = await adminClient
      .from("jobs")
      .insert({
        user_id: owner,
        quote_id: data.quoteId ?? null,
        notes: data.notes ?? "",
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return { id: inserted?.id };
  });

export const staffSetRole = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { userId: string; role: StaffRole }) => d)
  .handler(async ({ context, data }) => {
    const ctx = context!;
    const role = await requireStaff(ctx.userId);
    if (role !== "admin") throw new Error("Admin only");
    const { error } = await adminClient
      .from("profiles")
      .update({ role: data.role })
      .eq("user_id", data.userId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const staffListProfiles = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const ctx = context!;
    const role = await requireStaff(ctx.userId);
    if (role !== "admin") throw new Error("Admin only");
    const { data, error } = await adminClient
      .from("profiles")
      .select("user_id, email, display_name, role")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const staffOverridePrice = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { sku: string; sellExGst: number }) => d)
  .handler(async ({ context, data }) => {
    const ctx = context!;
    const role = await requireStaff(ctx.userId);
    if (role !== "admin" && role !== "sales") throw new Error("Not allowed");
    const { error } = await adminClient
      .from("product_overrides")
      .upsert({ sku: data.sku, sell_ex_gst: data.sellExGst, updated_at: new Date().toISOString() });

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const staffListOverrides = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const ctx = context!;
    await requireStaff(ctx.userId);
    const { data, error } = await adminClient
      .from("product_overrides")
      .select("sku, sell_ex_gst, stock_status");

    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const askBuilder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { message: string; lines: CartLine[]; driverWeightKg?: number }) => d)
  .handler(async ({ context, data }) => {
    const ctx = context!;
    await ensureProfile(ctx.userId);

    await adminClient.from("chat_messages").insert({
      user_id: ctx.userId,
      role: "user",
      content: data.message.slice(0, 4000),
    });

    const result = checkCart({ lines: data.lines, driverWeightKg: data.driverWeightKg });
    const apiKey = process.env.XAI_API_KEY;
    let reply: string;
    if (!apiKey) {
      reply = fallbackReply(data.message, result);
    } else {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "grok-4.5",
          max_tokens: 700,
          messages: [
            {
              role: "system",
              content: `You are the Everything Simulated build expert on the Gold Coast. Phone ${BRAND.phone}. Never invent SKUs. Only recommend these packages: ${PACKAGES.map((p) => p.slug).join(", ")} and catalogue SKUs: ${PRODUCTS.map((p) => p.sku).join(", ")}. Compatibility is decided by the checker JSON — do not override a block. Prices are AUD ex GST. Be concise and premium.`,
            },
            {
              role: "user",
              content: `Checker JSON: ${JSON.stringify(result)}\nCart: ${JSON.stringify(data.lines)}\nQuestion: ${data.message}`,
            },
          ],
        }),
      });
      if (!res.ok) {
        reply = fallbackReply(data.message, result);
      } else {
        const body = (await res.json()) as { choices: { message: { content: string } }[] };
        reply = body.choices[0]?.message.content ?? fallbackReply(data.message, result);
      }
    }

    await adminClient.from("chat_messages").insert({
      user_id: ctx.userId,
      role: "assistant",
      content: reply,
    });

    return { reply, result };
  });

export const listChat = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const ctx = context!;
    const { data, error } = await adminClient
      .from("chat_messages")
      .select("role, content")
      .eq("user_id", ctx.userId)
      .order("id", { ascending: false })
      .limit(20);

    if (error) throw new Error(error.message);
    return data ?? [];
  });

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

export const publicCatalog = createServerFn({ method: "GET" }).handler(async () => {
  return { products: PRODUCTS, packages: PACKAGES, guides: GUIDES, rules: RULES, brand: BRAND };
});

export { PRODUCT_MAP };
