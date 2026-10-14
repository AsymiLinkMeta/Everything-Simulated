import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { json, withCors } from "../_shared/cors.ts";
import { escapeHtml, escapeMultiline, safeHeader } from "../_shared/html.ts";
import { authorizeMail, type MailCaller, type MailKind, type MailOrder } from "../_shared/mail-auth.ts";
import { hasInternalSecret, isStaffRole } from "../_shared/auth.ts";
import { resolveSiteUrl } from "../_shared/site.ts";

/*
 * Transactional mail (Resend). Callers must be one of:
 *   - another edge function presenting X-Internal-Secret = INTERNAL_FUNCTION_SECRET
 *   - a signed-in staff user (any kind, any of their orders' customers)
 *   - a signed-in customer ("placed" only, own order, own email)
 * Every interpolated value is HTML-escaped. See _shared/mail-auth.ts.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

function wrap(title: string, bodyHtml: string, siteUrl: string) {
  const host = escapeHtml(new URL(siteUrl).host);
  return `<div style="font-family:Inter,Arial,sans-serif;background:#0a0a0b;color:#f4f4f5;padding:32px">
  <p style="letter-spacing:.2em;text-transform:uppercase;color:#e10600;font-size:12px">Everything Simulated</p>
  <h1 style="font-size:22px;font-weight:500">${escapeHtml(title)}</h1>
  <div style="color:#a1a1aa;font-size:15px;line-height:1.6">${bodyHtml}</div>
  <p style="margin-top:32px;font-size:12px;color:#71717a">Gold Coast workshop · 0404 619 056 · hello@everythingsimulated.com.au · ${host}</p>
</div>`;
}

async function identify(req: Request): Promise<MailCaller> {
  if (hasInternalSecret(req, Deno.env.get("INTERNAL_FUNCTION_SECRET") ?? "")) return { kind: "internal" };
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return { kind: "anonymous" };
  const caller = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data } = await caller.auth.getUser();
  if (!data.user) return { kind: "anonymous" };
  const { data: profile } = await caller.from("profiles").select("role").eq("user_id", data.user.id).maybeSingle();
  return { kind: "user", userId: data.user.id, email: data.user.email ?? null, isStaff: isStaffRole(profile?.role) };
}

Deno.serve(
  withCors(async (req: Request) => {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
    try {
      const body = (await req.json().catch(() => ({}))) as {
        orderId?: string;
        kind?: MailKind;
        email?: string;
        extra?: Record<string, unknown>;
      };
      const kind = (body.kind ?? "placed") as MailKind;
      const orderId = String(body.orderId ?? "").trim().slice(0, 64);
      const extra = body.extra && typeof body.extra === "object" ? body.extra : {};

      const caller = await identify(req);
      if (caller.kind === "anonymous") return json({ error: "Sign in required" }, 401);

      const admin = createClient(SUPABASE_URL, SERVICE_KEY);
      let order: Record<string, unknown> | null = null;
      let mailOrder: MailOrder = null;
      if (orderId) {
        const { data } = await admin.from("shop_orders").select("*").eq("id", orderId).maybeSingle();
        order = data;
        if (data) {
          let contactEmail: string | null = null;
          if (data.contact_id) {
            const { data: c } = await admin.from("crm_contacts").select("email").eq("id", data.contact_id).maybeSingle();
            contactEmail = c?.email ?? null;
          }
          mailOrder = { id: String(data.id), userId: data.user_id ?? null, contactEmail };
        }
      }

      const decision = authorizeMail({ caller, kind, order: mailOrder, requestedTo: body.email });
      if (!decision.ok) return json({ error: decision.error }, decision.status);
      const to = decision.to;

      const site = resolveSiteUrl(Deno.env.get("SITE_URL"));
      const id = escapeHtml(orderId);
      const tracking = escapeHtml(order?.tracking_number ?? extra.tracking ?? "");
      const invoice = escapeHtml(order?.invoice_number ?? "");
      const carrier = escapeHtml(order?.carrier ?? "ES Crate Freight");
      const total = Math.round(Number(order?.total_inc_gst ?? 0) / 100);
      const paid = Math.round(Number(order?.paid_cents ?? 0) / 100);
      const orderLink = `${site}/order`;

      const copy: Record<MailKind, { subject: string; html: string; staff: string }> = {
        placed: {
          subject: `Build request ${orderId}`,
          html: wrap(
            "We have your build request",
            `<p>Reference <strong>${id}</strong>. Total about $${total} inc GST.</p>
           <p>No payment has been taken yet. Track it any time at <a href="${escapeHtml(orderLink)}" style="color:#e10600">${escapeHtml(orderLink.replace(/^https?:\/\//, ""))}</a> with this ID and your email.</p>
           <p>The workshop will confirm the crate and send a deposit invoice unless you already paid online.</p>`,
            site,
          ),
          staff: `New order ${orderId} from ${to} · $${total} inc GST`,
        },
        paid: {
          subject: `Deposit received ${orderId}${order?.invoice_number ? ` · ${order.invoice_number}` : ""}`,
          html: wrap(
            "Deposit received",
            `<p>Thank you. ${invoice ? `Tax invoice <strong>${invoice}</strong>.` : ""} We recorded $${paid} towards ${id}.</p>
           <p>The Gold Coast workshop will schedule the build. Track packing at ${escapeHtml(orderLink)}.</p>`,
            site,
          ),
          staff: `Deposit paid on ${orderId} · $${paid}`,
        },
        tracking: {
          subject: `Your crate is moving · ${orderId}`,
          html: wrap(
            "Crate freight issued",
            `<p>${id} is packed. Carrier ${carrier} · <strong>${tracking || "number on the way"}</strong>.</p>
           <p>White-glove install is booked separately if you asked for it.</p>`,
            site,
          ),
          staff: `Tracking ${String(order?.tracking_number ?? extra.tracking ?? "")} on ${orderId}`,
        },
        refund: {
          subject: `Refund on ${orderId}`,
          html: wrap("Refund processed", `<p>A refund has been issued on ${id}. It returns to the original card in 5–10 business days.</p>`, site),
          staff: `Refund on ${orderId}`,
        },
        ticket: {
          subject: String(extra.subject ?? "") || `Workshop reply ${orderId}`.trim(),
          html: wrap("Workshop reply", `<p>${escapeMultiline(extra.body ?? "We have an update on your ticket.")}</p>`, site),
          staff: `Ticket reply to ${to}`,
        },
      };

      const msg = copy[kind];
      const subject = safeHeader(msg.subject);
      const from = Deno.env.get("MAIL_FROM") ?? "Everything Simulated <hello@everythingsimulated.com.au>";
      const staffInbox = Deno.env.get("STAFF_INBOX") ?? "hello@everythingsimulated.com.au";
      const key = Deno.env.get("RESEND_API_KEY") ?? "";

      async function send(toAddr: string, subj: string, html: string, kindLabel: string) {
        if (!key) {
          await admin.from("mail_log").insert({
            order_id: orderId || null,
            kind: kindLabel,
            to_email: toAddr,
            subject: subj,
            status: "skipped",
            error: "RESEND_API_KEY not set",
          });
          return { skipped: true };
        }
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from, to: [toAddr], subject: subj, html }),
        });
        const ok = res.ok;
        const errBody = ok ? null : await res.text();
        await admin.from("mail_log").insert({
          order_id: orderId || null,
          kind: kindLabel,
          to_email: toAddr,
          subject: subj,
          status: ok ? "sent" : "failed",
          error: errBody,
        });
        return { skipped: false, ok };
      }

      const customer = await send(to, subject, msg.html, kind);
      await send(
        staffInbox,
        safeHeader(`[ES] ${msg.staff}`),
        wrap("Staff copy", `<p>${escapeHtml(msg.staff)}</p><p>Customer ${escapeHtml(to)}</p>`, site),
        `${kind}_staff`,
      );
      return json({ ok: true, ...customer });
    } catch (err) {
      console.error("send-mail", err);
      return json({ error: "Mail failed" }, 500);
    }
  }),
);
