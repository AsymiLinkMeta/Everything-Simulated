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
    if (!stripeKey) return json({ error: "Card payments are not enabled yet." }, 503);

    const body = (await req.json()) as { orderId?: string; email?: string; origin?: string; full?: boolean };
    const orderId = String(body.orderId ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const origin = String(body.origin ?? "https://everythingsimulated.com.au").replace(/\/$/, "");
    if (!orderId || !email.includes("@")) return json({ error: "Order ID and email are required." }, 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: rows, error } = await supabase.rpc("lookup_guest_order", {
      p_order_id: orderId,
      p_email: email,
    });
    const order = Array.isArray(rows) ? rows[0] : rows;
    if (error || !order?.id) return json({ error: "No order matches that ID and email." }, 404);
    if (order.status === "cancelled") return json({ error: "This order is cancelled." }, 400);
    if ((order.paid_cents ?? 0) > 0 && order.status !== "pending") {
      return json({ error: "This order is already paid." }, 400);
    }

    const totalInc = Number(order.total_inc_gst) || 0;
    const percent = Number(Deno.env.get("DEPOSIT_PERCENT") ?? "30") || 30;
    const depositIncGst = body.full
      ? totalInc
      : Math.max(50000, Math.round((totalInc * percent) / 100));
    const depositExGst = Math.round(depositIncGst / 1.1);

    const params = new URLSearchParams();
    params.set("mode", "payment");
    params.set("success_url", `${origin}/order?id=${encodeURIComponent(orderId)}&paid=1`);
    params.set("cancel_url", `${origin}/order?id=${encodeURIComponent(orderId)}&cancelled=1`);
    params.set("client_reference_id", orderId);
    params.set("customer_email", email);
    params.set("line_items[0][quantity]", "1");
    params.set("line_items[0][price_data][currency]", "aud");
    params.set("line_items[0][price_data][unit_amount]", String(depositIncGst));
    params.set(
      "line_items[0][price_data][product_data][name]",
      body.full ? `Everything Simulated ${orderId}` : `Everything Simulated deposit ${orderId}`,
    );
    params.set("metadata[order_id]", orderId);
    params.set("metadata[email]", email);
    params.set("payment_intent_data[metadata][order_id]", orderId);

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });
    const session = (await stripeRes.json()) as { id?: string; url?: string; error?: { message: string } };
    if (!stripeRes.ok || !session.url) {
      return json({ error: session.error?.message ?? "Could not start Stripe Checkout." }, 502);
    }

    await supabase
      .from("shop_orders")
      .update({
        stripe_session_id: session.id,
        deposit_ex_gst: depositExGst,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    return json({ url: session.url, depositIncGst });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Checkout failed" }, 500);
  }
});
