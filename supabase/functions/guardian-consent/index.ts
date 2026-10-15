import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { json, withCors } from "../_shared/cors.ts";
import { isStaffRole } from "../_shared/auth.ts";
import { escapeHtml, safeHeader } from "../_shared/html.ts";
import { resolveSiteUrl } from "../_shared/site.ts";

/*
 * Emails a parent or guardian a single-use link to approve an under-18 ambassador.
 * Only used when ambassador_settings.guardian_method = "email" (the default is staff sign-off).
 * Callers: staff, or the ambassador themself. The raw token is minted by
 * create_guardian_token() (service role only), goes only into this email, and is
 * stored as a sha256. The link carries it in the URL fragment so it never reaches
 * a server log or Referer header.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

Deno.serve(
  withCors(async (req: Request) => {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
    try {
      const auth = req.headers.get("Authorization") ?? "";
      if (!auth.startsWith("Bearer ")) return json({ error: "Sign in required" }, 401);
      const caller = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
      const { data: who } = await caller.auth.getUser();
      if (!who.user) return json({ error: "Sign in required" }, 401);

      const body = (await req.json().catch(() => ({}))) as { ambassadorId?: string };
      const ambassadorId = String(body.ambassadorId ?? "");
      if (!/^[0-9a-f-]{36}$/i.test(ambassadorId)) return json({ error: "Ambassador required" }, 400);

      const admin = createClient(SUPABASE_URL, SERVICE_KEY);
      const [{ data: profile }, { data: amb }] = await Promise.all([
        admin.from("profiles").select("role").eq("user_id", who.user.id).maybeSingle(),
        admin.from("ambassadors").select("id, user_id").eq("id", ambassadorId).maybeSingle(),
      ]);
      if (!amb) return json({ error: "Ambassador not found" }, 404);
      if (!isStaffRole(profile?.role) && amb.user_id !== who.user.id) return json({ error: "Not allowed" }, 403);

      const { data: minted, error } = await admin.rpc("create_guardian_token", { p_ambassador: ambassadorId });
      if (error) return json({ error: error.message }, 400);
      const t = minted as { token: string; guardian_email: string; guardian_name: string; ambassador_name: string; expires_days: number };

      const site = resolveSiteUrl(Deno.env.get("SITE_URL"));
      const link = `${site}/guardian#t=${t.token}`;
      const subject = safeHeader(`Please approve ${t.ambassador_name} as an Everything Simulated ambassador`);
      const html = `<div style="font-family:Inter,Arial,sans-serif;background:#0a0a0b;color:#f4f4f5;padding:32px">
  <p style="letter-spacing:.2em;text-transform:uppercase;color:#e10600;font-size:12px">Everything Simulated</p>
  <h1 style="font-size:22px;font-weight:500">Guardian approval</h1>
  <div style="color:#a1a1aa;font-size:15px;line-height:1.6">
    <p>Hi ${escapeHtml(t.guardian_name || "there")},</p>
    <p>${escapeHtml(t.ambassador_name)} has been invited to be an Everything Simulated ambassador. Because they are under 18,
    their public profile and any commission payouts need your approval.</p>
    <p><a href="${escapeHtml(link)}" style="color:#e10600">Review and approve</a> (link valid for ${Number(t.expires_days) || 14} days).</p>
    <p>If you weren't expecting this, you can ignore this email or decline on that page.</p>
  </div></div>`;

      const key = Deno.env.get("RESEND_API_KEY") ?? "";
      const from = Deno.env.get("MAIL_FROM") ?? "Everything Simulated <hello@everythingsimulated.com.au>";
      let status = "skipped";
      let errText: string | null = "RESEND_API_KEY not set";
      if (key) {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from, to: [t.guardian_email], subject, html }),
        });
        status = res.ok ? "sent" : "failed";
        errText = res.ok ? null : await res.text();
      }
      await admin.from("mail_log").insert({ kind: "guardian", to_email: t.guardian_email, subject, status, error: errText });
      if (status === "failed") return json({ error: "Could not send the email" }, 502);
      return json({ ok: true, sent: status === "sent" });
    } catch (err) {
      console.error("guardian-consent", err);
      return json({ error: "Could not send the guardian email" }, 500);
    }
  }),
);
