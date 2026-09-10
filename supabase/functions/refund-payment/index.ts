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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
    if (!stripeKey) return json({ error: "Stripe is not configured." }, 503);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Sign in required" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: callerData } = await caller.auth.getUser();
    if (!callerData.user) return json({ error: "Sign in required" }, 401);
    const { data: profile } = await caller.from("profiles").select("role").eq("user_id", callerData.user.id).maybeSingle();
    if (!profile || !["admin", "sales", "support"].includes(profile.role)) {
      return json({ error: "Admin / sales only" }, 403);
    }

    const body = (await req.json()) as { orderId?: string; amountCents?: number };
    const orderId = String(body.orderId ?? "").trim();
    if (!orderId) return json({ error: "Order ID required" }, 400);

    const admin = createClient(supabaseUrl, service);
    const { data: order } = await admin
      .from("shop_orders")
      .select("id, stripe_payment_intent, paid_cents, refunded_cents, status")
      .eq("id", orderId)
      .maybeSingle();
    if (!order?.stripe_payment_intent) return json({ error: "No Stripe payment on this order." }, 400);

    const params = new URLSearchParams();
    params.set("payment_intent", order.stripe_payment_intent);
    if (body.amountCents && body.amountCents > 0) params.set("amount", String(body.amountCents));

    const stripeRes = await fetch("https://api.stripe.com/v1/refunds", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });
    const refund = (await stripeRes.json()) as { amount?: number; status?: string; error?: { message: string } };
    if (!stripeRes.ok) return json({ error: refund.error?.message ?? "Refund failed" }, 502);

    const refunded = Number(refund.amount) || 0;
    await admin
      .from("shop_orders")
      .update({
        refunded_cents: (order.refunded_cents ?? 0) + refunded,
        status: refunded >= (order.paid_cents ?? 0) ? "cancelled" : order.status,
        return_reason: refunded >= (order.paid_cents ?? 0) ? "Stripe refund" : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    return json({ refunded, status: refund.status ?? "succeeded" });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Refund failed" }, 500);
  }
});
