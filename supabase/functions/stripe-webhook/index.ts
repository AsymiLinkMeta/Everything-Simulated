import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { verifyStripeSignature } from "../_shared/stripe-signature.ts";

/*
 * Stripe webhook. Fails closed:
 *   - 500 if STRIPE_WEBHOOK_SECRET is not configured (Stripe will retry, nothing is trusted)
 *   - 400 on a missing/invalid signature or a timestamp outside the tolerance window
 * Idempotent: every event id is recorded in public.stripe_events before it is applied,
 * so retries and replays of the same event are acknowledged without re-applying.
 */

const text = (body: string, status: number) => new Response(body, { status, headers: { "Content-Type": "text/plain" } });

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return text("method not allowed", 405);
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
  if (!secret) {
    console.error("stripe-webhook: STRIPE_WEBHOOK_SECRET is not set; refusing event");
    return text("webhook not configured", 500);
  }

  const raw = await req.text();
  const tolerance = Number(Deno.env.get("STRIPE_WEBHOOK_TOLERANCE_SECONDS") ?? "300") || 300;
  const verified = await verifyStripeSignature({
    payload: raw,
    header: req.headers.get("stripe-signature"),
    secret,
    toleranceSeconds: tolerance,
  });
  if (!verified.ok) return text(`invalid signature: ${verified.reason}`, 400);

  let event: { id?: string; type?: string; data?: { object?: Record<string, unknown> } };
  try {
    event = JSON.parse(raw);
  } catch {
    return text("invalid json", 400);
  }
  const eventId = String(event.id ?? "");
  const type = String(event.type ?? "");
  if (!eventId) return text("missing event id", 400);

  const obj = event.data?.object ?? {};
  const metadata = (obj.metadata as Record<string, string> | undefined) ?? {};
  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

  let orderId = String((obj.client_reference_id as string) || metadata.order_id || "");
  // Charges don't inherit PaymentIntent metadata; match refunds by payment intent instead.
  if (!orderId && typeof obj.payment_intent === "string" && obj.payment_intent) {
    const { data } = await supabase
      .from("shop_orders")
      .select("id")
      .eq("stripe_payment_intent", obj.payment_intent)
      .maybeSingle();
    orderId = data?.id ?? "";
  }

  // Claim the event. A unique violation means we've already processed it.
  const { error: claimErr } = await supabase
    .from("stripe_events")
    .insert({ id: eventId, type, order_id: orderId || null });
  if (claimErr) {
    if (claimErr.code === "23505") return text("duplicate", 200);
    console.error("stripe-webhook: could not record event", claimErr);
    return text("storage error", 500);
  }

  try {
    if (!orderId) return text("ok (no order)", 200);

    if (type === "checkout.session.completed") {
      if (obj.payment_status && obj.payment_status !== "paid") return text("ok (unpaid session)", 200);
      const amount = Number(obj.amount_total) || 0;
      const intent = String(obj.payment_intent ?? "");
      const { data: order, error: readErr } = await supabase
        .from("shop_orders")
        .select("id, status, paid_cents, invoice_number")
        .eq("id", orderId)
        .maybeSingle();
      if (readErr) throw readErr;
      if (!order) return text("ok (unknown order)", 200);

      const { error: updErr } = await supabase
        .from("shop_orders")
        .update({
          status: order.status === "pending" ? "paid" : order.status,
          paid_cents: (Number(order.paid_cents) || 0) + amount,
          stripe_payment_intent: intent || null,
          stripe_session_id: String(obj.id ?? ""),
          invoice_number: order.invoice_number || `ESI-${Date.now().toString(36).toUpperCase()}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);
      if (updErr) throw updErr;

      const internal = Deno.env.get("INTERNAL_FUNCTION_SECRET") ?? "";
      if (internal) {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-mail`, {
          method: "POST",
          headers: {
            "X-Internal-Secret": internal,
            Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY") ?? ""}`,
            Apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
            "Content-Type": "application/json",
          },
          // Recipient comes from the order itself, never from the Stripe payload.
          body: JSON.stringify({ orderId, kind: "paid" }),
        }).catch((e) => console.error("stripe-webhook: mail failed", e));
      }
    }

    if (type === "charge.refunded") {
      // amount_refunded on a Charge is cumulative, so setting it is idempotent.
      const amount = Number(obj.amount_refunded) || 0;
      if (amount) {
        const { error } = await supabase
          .from("shop_orders")
          .update({ refunded_cents: amount, updated_at: new Date().toISOString() })
          .eq("id", orderId);
        if (error) throw error;
      }
    }

    return text("ok", 200);
  } catch (err) {
    // Release the claim so Stripe's retry can apply the event.
    await supabase.from("stripe_events").delete().eq("id", eventId);
    console.error("stripe-webhook: processing failed", err);
    return text("processing error", 500);
  }
});
