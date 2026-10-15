/**
 * Local API gateway + edge-function host for development and e2e tests.
 *
 *   deno run -A --node-modules-dir=none local/gateway.ts
 *
 * Serves http://localhost:54321 like a Supabase project:
 *   /auth/v1/*       -> GoTrue   (127.0.0.1:54331)
 *   /rest/v1/*       -> PostgREST (127.0.0.1:54332)
 *   /functions/v1/x  -> supabase/functions/x/index.ts, loaded in-process, with
 *                       verify_jwt enforced from supabase/config.toml
 *
 * Outbound calls to Stripe, Resend and xAI are answered by in-process mocks so
 * nothing leaves the box. The Stripe mock hosts a test checkout page at
 * /__mock/stripe/checkout/<session>; "Pay" sends a *signed* checkout.session.completed
 * event to the real stripe-webhook function, exactly as Stripe would.
 * Test helpers: GET /__mock/stripe/sessions, GET /__mock/mail, GET /__mock/ai.
 */
import { signStripePayload } from "../supabase/functions/_shared/stripe-signature.ts";

const env = Object.fromEntries(
  Deno.readTextFileSync(new URL("./stack.env", import.meta.url))
    .split("\n").filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const PORT = Number(Deno.env.get("GATEWAY_PORT") ?? 54321);
const BASE = `http://localhost:${PORT}`;
const SITE = Deno.env.get("SITE_URL") ?? "http://localhost:5173";
const WEBHOOK_SECRET = "whsec_local_test_secret";

const fnEnv: Record<string, string> = {
  SUPABASE_URL: BASE,
  SUPABASE_ANON_KEY: env.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: env.SERVICE_ROLE_KEY,
  SITE_URL: SITE,
  ALLOWED_ORIGINS: [SITE, "http://127.0.0.1:5173", "http://localhost:4173", "http://127.0.0.1:4173", ...(Deno.env.get("EXTRA_ALLOWED_ORIGINS") ?? "").split(",")].filter(Boolean).join(","),
  INTERNAL_FUNCTION_SECRET: "local-internal-secret",
  STRIPE_SECRET_KEY: "sk_test_local_mock",
  STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
  STRIPE_WEBHOOK_TOLERANCE_SECONDS: "300",
  DEPOSIT_PERCENT: "30",
  RESEND_API_KEY: "re_local_mock",
  MAIL_FROM: "Everything Simulated <hello@everythingsimulated.local>",
  STAFF_INBOX: "staff@everythingsimulated.local",
  XAI_API_KEY: Deno.env.get("MOCK_AI") === "off" ? "" : "xai_local_mock",
};
for (const [k, v] of Object.entries(fnEnv)) Deno.env.set(k, v);

// ---------- outbound mocks ----------
type Session = { id: string; params: Record<string, string>; status: "open" | "paid"; payment_intent: string };
const sessions = new Map<string, Session>();
const mail: unknown[] = [];
const ai: unknown[] = [];
const realFetch = globalThis.fetch.bind(globalThis);
let seq = 0;

function aiReply(body: Record<string, unknown>) {
  ai.push(body);
  const messages = (body.messages as { role: string; content: string }[] | undefined) ?? [];
  const last = messages.at(-1)?.content ?? "";
  // Callers that ask for JSON get a small, valid JSON object they can parse.
  const wantsJson = /json/i.test(JSON.stringify(messages.slice(0, 1))) || body.response_format;
  // generate-product-listing: return a listing that passes its isListing() check.
  const wantsListing = /manufacturerUrl/.test(JSON.stringify(messages.slice(0, 1)));
  const content = wantsListing
    ? JSON.stringify({
      sku: "mock-wheelbase-15", brand: "Mockbrand", name: "Mock listing title", category: "wheelbase",
      price: 0, description: "Mock description from the local xAI stub.", notes: "Mock notes.",
      images: [], whatsIncluded: ["Wheelbase"], mountCompatibility: "", specs: { Torque: "15 Nm" },
      compare: "", mounts: [], maxNm: 15, payloadKg: null, weightKg: 9, qr: null,
    })
    : wantsJson
    ? JSON.stringify({
      reply: "Mock adviser: that combination works. Consider a quick-release for easy swaps.",
      title: "Mock listing title", summary: "Mock summary.", description: "Mock description.",
      bullets: ["Mock bullet"], name: "Mock prebuild", blurb: "Mock blurb", actions: [],
    })
    : `Mock adviser reply to: ${String(last).slice(0, 80)}`;
  return Response.json({ id: "mock", choices: [{ index: 0, message: { role: "assistant", content } }] });
}

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const req = new Request(input, init);
  const url = new URL(req.url);
  if (url.hostname === "api.stripe.com") {
    const form = Object.fromEntries(new URLSearchParams(await req.text()));
    if (url.pathname === "/v1/checkout/sessions") {
      const id = `cs_test_${Date.now().toString(36)}${++seq}`;
      sessions.set(id, { id, params: form, status: "open", payment_intent: `pi_test_${id.slice(8)}` });
      return Response.json({ id, url: `${BASE}/__mock/stripe/checkout/${id}` });
    }
    if (url.pathname === "/v1/refunds") {
      return Response.json({ id: `re_test_${++seq}`, status: "succeeded", amount: Number(form.amount) || 0, payment_intent: form.payment_intent });
    }
    return Response.json({ error: { message: `mock: unsupported ${url.pathname}` } }, { status: 400 });
  }
  if (url.hostname === "api.resend.com") {
    mail.push(await req.json());
    return Response.json({ id: `mail_${++seq}` });
  }
  if (url.hostname === "api.x.ai") return aiReply(await req.json());
  // Product-page scraping in AI listing: never hit the internet from tests.
  if (!["localhost", "127.0.0.1"].includes(url.hostname)) {
    return new Response(`<html><head><title>Mock ${url.hostname}</title></head><body><h1>Mock product</h1><p>Direct drive wheelbase, 15 Nm.</p></body></html>`, { headers: { "content-type": "text/html" } });
  }
  return realFetch(req);
}) as typeof fetch;

// ---------- load functions in-process ----------
const config = Deno.readTextFileSync(new URL("../supabase/config.toml", import.meta.url));
const verifyJwt: Record<string, boolean> = {};
for (const m of config.matchAll(/\[functions\.([a-z0-9-]+)\]\s*\n\s*verify_jwt\s*=\s*(true|false)/g)) verifyJwt[m[1]] = m[2] === "true";

type Handler = (req: Request) => Response | Promise<Response>;
const handlers: Record<string, Handler> = {};
let capturing = "";
const realServe = Deno.serve;
// deno-lint-ignore no-explicit-any
(Deno as any).serve = (a: any, b?: any) => {
  const h = typeof a === "function" ? a : (b ?? a.handler);
  handlers[capturing] = h;
  return { finished: Promise.resolve(), shutdown: async () => {}, ref() {}, unref() {}, addr: { port: 0 } };
};
for (const entry of Deno.readDirSync(new URL("../supabase/functions/", import.meta.url))) {
  if (!entry.isDirectory || entry.name.startsWith("_")) continue;
  capturing = entry.name;
  await import(`../supabase/functions/${entry.name}/index.ts`);
}
// deno-lint-ignore no-explicit-any
(Deno as any).serve = realServe;
console.log("functions:", Object.keys(handlers).sort().join(", "));

async function validJwt(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const [h, p, s] = token.split(".");
  if (!h || !p || !s) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.JWT_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const sig = Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
  const ok = await crypto.subtle.verify("HMAC", key, sig, new TextEncoder().encode(`${h}.${p}`));
  if (!ok) return false;
  const claims = JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/")));
  return !claims.exp || claims.exp * 1000 > Date.now();
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, prefer, range, accept-profile, content-profile, x-supabase-api-version",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Expose-Headers": "content-range, x-supabase-api-version",
};

async function proxy(req: Request, target: string, strip: string) {
  const url = new URL(req.url);
  const to = target + url.pathname.slice(strip.length) + url.search;
  const headers = new Headers(req.headers);
  headers.delete("host");
  const res = await realFetch(to, {
    method: req.method, headers, redirect: "manual",
    body: ["GET", "HEAD"].includes(req.method) ? undefined : await req.arrayBuffer(),
  });
  const out = new Headers(res.headers);
  for (const [k, v] of Object.entries(cors)) out.set(k, v);
  return new Response(res.body, { status: res.status, headers: out });
}

function checkoutPage(s: Session) {
  const amount = (Number(s.params["line_items[0][price_data][unit_amount]"]) / 100).toFixed(2);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Stripe test checkout</title>
<meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font-family:sans-serif;max-width:420px;margin:40px auto">
<h1>Test mode checkout</h1><p data-testid="mock-stripe-product">${s.params["line_items[0][price_data][product_data][name]"]}</p>
<p>Amount: <strong data-testid="mock-stripe-amount">A$${amount}</strong></p>
<form method="post" action="/__mock/stripe/checkout/${s.id}/pay"><button type="submit">Pay A$${amount}</button></form>
<p><a href="${s.params.cancel_url}">Cancel</a></p></body></html>`;
}

export async function sendSignedEvent(type: string, object: Record<string, unknown>, id = `evt_test_${Date.now().toString(36)}${++seq}`) {
  const payload = JSON.stringify({ id, type, object: "event", data: { object } });
  const header = await signStripePayload(payload, WEBHOOK_SECRET, Math.floor(Date.now() / 1000));
  return await handlers["stripe-webhook"](new Request(`${BASE}/functions/v1/stripe-webhook`, {
    method: "POST", headers: { "stripe-signature": header, "content-type": "application/json" }, body: payload,
  }));
}

realServe({ port: PORT, hostname: "0.0.0.0" }, async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;
  if (req.method === "OPTIONS" && !path.startsWith("/functions/")) return new Response(null, { status: 204, headers: cors });
  try {
    if (path.startsWith("/auth/v1")) return await proxy(req, "http://127.0.0.1:54331", "/auth/v1");
    if (path.startsWith("/rest/v1")) return await proxy(req, "http://127.0.0.1:54332", "/rest/v1");
    const fm = path.match(/^\/functions\/v1\/([a-z0-9-]+)/);
    if (fm) {
      const h = handlers[fm[1]];
      if (!h) return new Response(JSON.stringify({ error: "function not found" }), { status: 404 });
      if (req.method !== "OPTIONS" && verifyJwt[fm[1]] !== false && !(await validJwt(req))) {
        return new Response(JSON.stringify({ code: 401, message: "Invalid JWT" }), { status: 401, headers: { ...cors, "content-type": "application/json" } });
      }
      return await h(req);
    }
    const cm = path.match(/^\/__mock\/stripe\/checkout\/([\w]+)(\/pay)?$/);
    if (cm) {
      const s = sessions.get(cm[1]);
      if (!s) return new Response("unknown session", { status: 404 });
      if (!cm[2]) return new Response(checkoutPage(s), { headers: { "content-type": "text/html; charset=utf-8" } });
      s.status = "paid";
      const res = await sendSignedEvent("checkout.session.completed", {
        id: s.id, object: "checkout.session", payment_status: "paid",
        amount_total: Number(s.params["line_items[0][price_data][unit_amount]"]),
        client_reference_id: s.params.client_reference_id, payment_intent: s.payment_intent,
        metadata: { order_id: s.params["metadata[order_id]"], email: s.params["metadata[email]"] },
      });
      if (!res.ok) return new Response(`webhook failed: ${res.status} ${await res.text()}`, { status: 500 });
      return Response.redirect(s.params.success_url, 303);
    }
    if (path === "/__mock/stripe/sessions") return Response.json([...sessions.values()], { headers: cors });
    if (path === "/__mock/stripe/event" && req.method === "POST") {
      const b = await req.json();
      const res = await sendSignedEvent(b.type, b.object, b.id);
      return new Response(await res.text(), { status: res.status, headers: cors });
    }
    if (path === "/__mock/mail") return Response.json(mail, { headers: cors });
    if (path === "/__mock/ai") return Response.json(ai, { headers: cors });
    if (path === "/__mock/reset" && req.method === "POST") { sessions.clear(); mail.length = 0; ai.length = 0; return new Response("ok", { headers: cors }); }
    if (path === "/health") return Response.json({ ok: true, functions: Object.keys(handlers) });
    return new Response("not found", { status: 404 });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 502, headers: { ...cors, "content-type": "application/json" } });
  }
});
