import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Kind = "placed" | "paid" | "tracking" | "refund" | "ticket";

function wrap(title: string, body: string) {
  return `<div style="font-family:Inter,Arial,sans-serif;background:#0a0a0b;color:#f4f4f5;padding:32px">
  <p style="letter-spacing:.2em;text-transform:uppercase;color:#e10600;font-size:12px">Everything Simulated</p>
  <h1 style="font-size:22px;font-weight:500">${title}</h1>
  <div style="color:#a1a1aa;font-size:15px;line-height:1.6">${body}</div>
  <p style="margin-top:32px;font-size:12px;color:#71717a">Gold Coast workshop · 0404 619 056 · hello@everythingsimulated.com.au</p>
</div>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const body = (await req.json()) as {
      orderId?: string;
      kind?: Kind;
      email?: string;
      extra?: Record<string, string>;
    };
    const kind = (body.kind ?? "placed") as Kind;
    const orderId = String(body.orderId ?? "").trim();
    if (!orderId && kind !== "ticket") return json({ error: "orderId required" }, 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    let to = String(body.email ?? "").trim().toLowerCase();
    let order: Record<string, unknown> | null = null;
    if (orderId) {
      const { data } = await supabase.from("shop_orders").select("*").eq("id", orderId).maybeSingle();
      order = data;
      if (!to && data?.contact_id) {
        const { data: c } = await supabase.from("crm_contacts").select("email").eq("id", data.contact_id).maybeSingle();
        to = String(c?.email ?? "").toLowerCase();
      }
    }
    if (!to || !to.includes("@")) return json({ error: "No customer email" }, 400);

    const tracking = String(order?.tracking_number ?? body.extra?.tracking ?? "");
    const invoice = String(order?.invoice_number ?? "");
    const total = Math.round(Number(order?.total_inc_gst ?? 0) / 100);
    const paid = Math.round(Number(order?.paid_cents ?? 0) / 100);

    const copy: Record<Kind, { subject: string; html: string; staff: string }> = {
      placed: {
        subject: `Build request ${orderId}`,
        html: wrap(
          "We have your build request",
          `<p>Reference <strong>${orderId}</strong>. Total about $${total} inc GST.</p>
           <p>No payment has been taken yet. Track it any time at <a href="https://everythingsimulated.com.au/order" style="color:#e10600">everythingsimulated.com.au/order</a> with this ID and your email.</p>
           <p>The workshop will confirm the crate and send a deposit invoice unless you already paid online.</p>`,
        ),
        staff: `New order ${orderId} from ${to} · $${total} inc GST`,
      },
      paid: {
        subject: `Deposit received ${orderId}${invoice ? ` · ${invoice}` : ""}`,
        html: wrap(
          "Deposit received",
          `<p>Thank you. ${invoice ? `Tax invoice <strong>${invoice}</strong>.` : ""} We recorded $${paid} towards ${orderId}.</p>
           <p>The Gold Coast workshop will schedule the build. Track packing at everythingsimulated.com.au/order.</p>`,
        ),
        staff: `Deposit paid on ${orderId} · $${paid}`,
      },
      tracking: {
        subject: `Your crate is moving · ${orderId}`,
        html: wrap(
          "Crate freight issued",
          `<p>${orderId} is packed. Carrier ${order?.carrier ?? "ES Crate Freight"} · <strong>${tracking || "number on the way"}</strong>.</p>
           <p>White-glove install is booked separately if you asked for it.</p>`,
        ),
        staff: `Tracking ${tracking} on ${orderId}`,
      },
      refund: {
        subject: `Refund on ${orderId}`,
        html: wrap("Refund processed", `<p>A refund has been issued on ${orderId}. It returns to the original card in 5–10 business days.</p>`),
        staff: `Refund on ${orderId}`,
      },
      ticket: {
        subject: body.extra?.subject || `Workshop reply ${orderId || ""}`.trim(),
        html: wrap("Workshop reply", `<p>${body.extra?.body ?? "We have an update on your ticket."}</p>`),
        staff: `Ticket reply to ${to}`,
      },
    };

    const msg = copy[kind] ?? copy.placed;
    const from = Deno.env.get("MAIL_FROM") ?? "Everything Simulated <hello@everythingsimulated.com.au>";
    const staffInbox = Deno.env.get("STAFF_INBOX") ?? "hello@everythingsimulated.com.au";
    const key = Deno.env.get("RESEND_API_KEY") ?? "";

    async function send(toAddr: string, subject: string, html: string, kindLabel: string) {
      if (!key) {
        await supabase.from("mail_log").insert({
          order_id: orderId || null,
          kind: kindLabel,
          to_email: toAddr,
          subject,
          status: "skipped",
          error: "RESEND_API_KEY not set",
        });
        return { skipped: true };
      }
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [toAddr], subject, html }),
      });
      const ok = res.ok;
      const errBody = ok ? null : await res.text();
      await supabase.from("mail_log").insert({
        order_id: orderId || null,
        kind: kindLabel,
        to_email: toAddr,
        subject,
        status: ok ? "sent" : "failed",
        error: errBody,
      });
      return { skipped: false, ok };
    }

    const customer = await send(to, msg.subject, msg.html, kind);
    await send(staffInbox, `[ES] ${msg.staff}`, wrap("Staff copy", `<p>${msg.staff}</p><p>Customer ${to}</p>`), `${kind}_staff`);
    return json({ ok: true, ...customer, to });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Mail failed" }, 500);
  }
});
