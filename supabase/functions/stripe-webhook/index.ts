import { createClient } from "npm:@supabase/supabase-js@2.45.4";

async function hmacHex(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

Deno.serve(async (req: Request) => {
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  const raw = await req.text();

  if (secret) {
    const header = req.headers.get("stripe-signature") ?? "";
    const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
    const signed = `${parts.t}.${raw}`;
    const expected = await hmacHex(secret, signed);
    if (!parts.v1 || !timingSafeEqual(expected, parts.v1)) {
      return new Response("invalid signature", { status: 400 });
    }
  }

  const event = JSON.parse(raw) as {
    type?: string;
    data?: { object?: Record<string, unknown> };
  };
  const obj = event.data?.object ?? {};
  const orderId = String(
    (obj.client_reference_id as string) ||
      ((obj.metadata as Record<string, string> | undefined)?.order_id ?? ""),
  );
  if (!orderId) return new Response("ok", { status: 200 });

  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

  if (event.type === "checkout.session.completed") {
    const amount = Number(obj.amount_total) || 0;
    const intent = String(obj.payment_intent ?? "");
    const invoice = `ESI-${Date.now().toString(36).toUpperCase()}`;
    await supabase
      .from("shop_orders")
      .update({
        status: "paid",
        paid_cents: amount,
        stripe_payment_intent: intent || null,
        stripe_session_id: String(obj.id ?? ""),
        invoice_number: invoice,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    const email = String(obj.customer_email ?? (obj.customer_details as { email?: string } | undefined)?.email ?? "");
    if (email) {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-mail`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          Apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderId, kind: "paid", email }),
      }).catch(() => {});
    }
  }

  if (event.type === "charge.refunded" || event.type === "refund.updated") {
    const amount = Number(obj.amount_refunded ?? obj.amount) || 0;
    if (amount) {
      await supabase
        .from("shop_orders")
        .update({ refunded_cents: amount, updated_at: new Date().toISOString() })
        .eq("id", orderId);
    }
  }

  void stripeKey;
  return new Response("ok", { status: 200 });
});
