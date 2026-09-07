import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { BRAND, GUIDES, PACKAGES, PRODUCT_MAP, PRODUCTS, RULES } from "./catalog";
import { checkCart } from "./checkCart";
import type { CartLine, StaffRole } from "./types";

const STAFF: StaffRole[] = ["sales", "workshop", "content", "support", "admin"];

async function ensureProfile(userId: string, email?: string | null, name?: string | null) {
  const sql = await getSql();
  const existing = await sql<{ user_id: string; role: string }>`
    select user_id, role from profiles where user_id = ${userId}
  `;
  if (existing[0]) return existing[0];
  const count = await sql<{ n: number }>`select count(*)::int as n from profiles where role = 'admin'`;
  const role = (count[0]?.n ?? 0) === 0 ? "admin" : "customer";
  await sql`
    insert into profiles (user_id, email, display_name, role)
    values (${userId}, ${email ?? null}, ${name ?? null}, ${role})
  `;
  return { user_id: userId, role };
}

export const getProfile = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const row = await ensureProfile(context.userId);
    return { userId: context.userId, role: row.role as StaffRole, isStaff: STAFF.includes(row.role as StaffRole) };
  });

export const saveQuote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { lines: CartLine[]; postcode?: string; title?: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureProfile(context.userId);
    const result = checkCart({ lines: data.lines });
    const id = `ES-${Date.now().toString(36).toUpperCase()}`;
    await sql`
      insert into quotes (id, user_id, title, status, lines, check_ok, total_ex_gst, postcode)
      values (
        ${id},
        ${context.userId},
        ${data.title ?? "Custom build"},
        ${result.ok ? "quoted" : "draft"},
        ${JSON.stringify(data.lines)}::jsonb,
        ${result.ok},
        ${result.totalExGst},
        ${data.postcode ?? null}
      )
    `;
    return { id, result };
  });

export const listMyQuotes = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    return sql<{
      id: string;
      title: string;
      status: string;
      total_ex_gst: number;
      check_ok: boolean;
      created_at: string;
    }>`
      select id, title, status, total_ex_gst, check_ok, created_at
      from quotes where user_id = ${context.userId}
      order by created_at desc
    `;
  });

export const requestBooking = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { kind: string; slot?: string; notes?: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureProfile(context.userId);
    const rows = await sql<{ id: number }>`
      insert into bookings (user_id, kind, slot, notes)
      values (${context.userId}, ${data.kind}, ${data.slot ?? null}, ${data.notes ?? ""})
      returning id
    `;
    return { id: rows[0]?.id };
  });

export const listMyBookings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    return sql<{ id: number; kind: string; slot: string | null; status: string }>`
      select id, kind, slot, status from bookings
      where user_id = ${context.userId}
      order by created_at desc
    `;
  });

export const listMyJobs = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    return sql<{ id: number; stage: string; notes: string; quote_id: string | null }>`
      select id, stage, notes, quote_id from jobs
      where user_id = ${context.userId}
      order by created_at desc
    `;
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
    await requireStaff(context.userId);
    const sql = await getSql();
    return sql<{
      id: string;
      user_id: string;
      title: string;
      status: string;
      total_ex_gst: number;
      check_ok: boolean;
    }>`
      select id, user_id, title, status, total_ex_gst, check_ok
      from quotes order by created_at desc limit 50
    `;
  });

export const staffListJobs = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireStaff(context.userId);
    const sql = await getSql();
    return sql<{ id: number; user_id: string; stage: string; notes: string; quote_id: string | null }>`
      select id, user_id, stage, notes, quote_id from jobs order by created_at desc limit 50
    `;
  });

export const staffListBookings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireStaff(context.userId);
    const sql = await getSql();
    return sql<{
      id: number;
      user_id: string;
      kind: string;
      slot: string | null;
      status: string;
      notes: string;
    }>`
      select id, user_id, kind, slot, status, notes from bookings
      order by created_at desc limit 50
    `;
  });

export const staffSetJobStage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: number; stage: string }) => d)
  .handler(async ({ context, data }) => {
    await requireStaff(context.userId);
    const sql = await getSql();
    await sql`update jobs set stage = ${data.stage} where id = ${data.id}`;
    return { ok: true };
  });

export const staffCreateJob = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { quoteId?: string; notes?: string }) => d)
  .handler(async ({ context, data }) => {
    await requireStaff(context.userId);
    const sql = await getSql();
    const q = data.quoteId
      ? await sql<{ user_id: string }>`select user_id from quotes where id = ${data.quoteId}`
      : [];
    const owner = q[0]?.user_id ?? context.userId;
    const rows = await sql<{ id: number }>`
      insert into jobs (user_id, quote_id, notes)
      values (${owner}, ${data.quoteId ?? null}, ${data.notes ?? ""})
      returning id
    `;
    return { id: rows[0]?.id };
  });

export const staffSetRole = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { userId: string; role: StaffRole }) => d)
  .handler(async ({ context, data }) => {
    const role = await requireStaff(context.userId);
    if (role !== "admin") throw new Error("Admin only");
    const sql = await getSql();
    await sql`update profiles set role = ${data.role} where user_id = ${data.userId}`;
    return { ok: true };
  });

export const staffListProfiles = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const role = await requireStaff(context.userId);
    if (role !== "admin") throw new Error("Admin only");
    const sql = await getSql();
    return sql<{ user_id: string; email: string | null; display_name: string | null; role: string }>`
      select user_id, email, display_name, role from profiles order by created_at desc
    `;
  });

export const staffOverridePrice = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { sku: string; sellExGst: number }) => d)
  .handler(async ({ context, data }) => {
    const role = await requireStaff(context.userId);
    if (role !== "admin" && role !== "sales") throw new Error("Not allowed");
    const sql = await getSql();
    await sql`
      insert into product_overrides (sku, sell_ex_gst, updated_at)
      values (${data.sku}, ${data.sellExGst}, now())
      on conflict (sku) do update set sell_ex_gst = ${data.sellExGst}, updated_at = now()
    `;
    return { ok: true };
  });

export const staffListOverrides = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireStaff(context.userId);
    const sql = await getSql();
    return sql<{ sku: string; sell_ex_gst: number | null; stock_status: string | null }>`
      select sku, sell_ex_gst, stock_status from product_overrides
    `;
  });

export const askBuilder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { message: string; lines: CartLine[]; driverWeightKg?: number }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureProfile(context.userId);
    await sql`
      insert into chat_messages (user_id, role, content)
      values (${context.userId}, 'user', ${data.message.slice(0, 4000)})
    `;
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
    await sql`
      insert into chat_messages (user_id, role, content)
      values (${context.userId}, 'assistant', ${reply})
    `;
    return { reply, result };
  });

export const listChat = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    return sql<{ role: string; content: string }>`
      select role, content from chat_messages
      where user_id = ${context.userId}
      order by id desc limit 20
    `;
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
