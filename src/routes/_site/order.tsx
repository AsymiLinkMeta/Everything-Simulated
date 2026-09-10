import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search, Package, Truck } from "lucide-react";
import { supabase } from "@/lib/db";
import { aud } from "@/lib/utils";
import { pageHead } from "@/lib/es/seo";
import { fetchBillingConfig, startDepositCheckout } from "@/lib/es/billing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_site/order")({
  head: () =>
    pageHead({
      title: "Track an order | Everything Simulated",
      description: "Look up your build request by order ID and email.",
      path: "/order",
    }),
  component: TrackOrder,
});

type OrderRow = {
  id: string;
  status: string;
  total_ex_gst: number;
  total_inc_gst: number;
  tracking_number: string | null;
  carrier: string | null;
  notes: string | null;
  created_at: string;
  invoice_number?: string | null;
  paid_cents?: number | null;
  refunded_cents?: number | null;
};

function statusTone(s: string) {
  if (s === "delivered" || s === "paid") return "ok";
  if (s === "cancelled") return "bad";
  return "warn";
}

function TrackOrder() {
  const params = typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const [orderId, setOrderId] = useState(params.get("id") ?? "");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stripeOn, setStripeOn] = useState(false);
  const paidFlag = params.get("paid") === "1";

  useEffect(() => {
    fetchBillingConfig().then((c) => setStripeOn(c.stripe)).catch(() => {});
  }, []);

  async function lookup(id: string, mail: string) {
    const { data, error: rpcError } = await supabase.rpc("lookup_guest_order", {
      p_order_id: id,
      p_email: mail,
    });
    if (rpcError) throw new Error(rpcError.message);
    if (!data || (Array.isArray(data) && data.length === 0)) {
      throw new Error("No order found with that ID and email.");
    }
    const row = Array.isArray(data) ? data[0] : data;
    setOrder(row as OrderRow);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const id = orderId.trim();
    const mail = email.trim().toLowerCase();
    if (!id || !mail) {
      setError("Enter your order ID and the email used at checkout.");
      return;
    }
    setLoading(true);
    setError(null);
    setOrder(null);
    try {
      await lookup(id, mail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not look up the order. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function payDeposit() {
    if (!order) return;
    const mail = email.trim().toLowerCase();
    if (!mail) {
      setError("Enter the checkout email so we can match the payment.");
      return;
    }
    setPaying(true);
    try {
      const session = await startDepositCheckout({
        orderId: order.id,
        email: mail,
        origin: window.location.origin,
      });
      window.location.href = session.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start payment.");
      setPaying(false);
    }
  }

  if (order) {
    const tone = statusTone(order.status);
    const toneClass =
      tone === "ok" ? "text-emerald-400" : tone === "bad" ? "text-red-400" : "text-amber-400";
    return (
      <div className="mx-auto max-w-lg px-5 py-12">
        <Link to="/order" className="mb-6 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-paper">
          <Search className="size-3.5" /> Track another order
        </Link>
        {paidFlag ? (
          <p className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            Stripe reported the deposit. It can take a few seconds to show as paid.
          </p>
        ) : null}
        <div className="es-card space-y-5 p-6">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-medium">Order {order.id}</h1>
            <span className={`text-sm font-medium capitalize ${toneClass}`}>{order.status}</span>
          </div>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Submitted</dt>
              <dd>{new Date(order.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Total (inc GST)</dt>
              <dd className="tabular-nums">{aud(order.total_inc_gst)}</dd>
            </div>
            {order.paid_cents ? (
              <div className="flex justify-between">
                <dt className="text-muted">Paid</dt>
                <dd className="tabular-nums">{aud(order.paid_cents)}</dd>
              </div>
            ) : null}
            {order.refunded_cents ? (
              <div className="flex justify-between">
                <dt className="text-muted">Refunded</dt>
                <dd className="tabular-nums">{aud(order.refunded_cents)}</dd>
              </div>
            ) : null}
            {order.invoice_number ? (
              <div className="flex justify-between">
                <dt className="text-muted">Invoice</dt>
                <dd className="font-mono">{order.invoice_number}</dd>
              </div>
            ) : null}
            {order.tracking_number && (
              <div className="flex justify-between">
                <dt className="text-muted flex items-center gap-1.5"><Truck className="size-3.5" /> Tracking</dt>
                <dd className="font-mono">{order.tracking_number}</dd>
              </div>
            )}
            {order.carrier && (
              <div className="flex justify-between">
                <dt className="text-muted">Carrier</dt>
                <dd>{order.carrier}</dd>
              </div>
            )}
            {order.notes && (
              <div className="border-t border-line pt-3">
                <dt className="text-muted">Notes</dt>
                <dd className="mt-1 text-paper">{order.notes}</dd>
              </div>
            )}
          </dl>
          <div className="rounded-lg bg-raised p-4 text-sm text-muted">
            <Package className="mb-2 size-4 text-muted" />
            {order.status === "pending" && "Build request received. Pay the deposit below or wait for the workshop invoice."}
            {order.status === "paid" && "Deposit received. Your build is queued for the workshop."}
            {order.status === "packing" && "Your rig is being assembled and QA tested."}
            {order.status === "shipped" && "Your crate is in transit."}
            {order.status === "delivered" && "Delivered. Enjoy the rig."}
            {order.status === "cancelled" && "This order was cancelled."}
          </div>
          {stripeOn && order.status === "pending" && !(order.paid_cents ?? 0) ? (
            <Button className="w-full" disabled={paying} onClick={() => void payDeposit()}>
              {paying ? "Redirecting to Stripe…" : "Pay deposit"}
            </Button>
          ) : null}
          <Button asChild variant="outline" className="w-full">
            <Link to="/contact">Contact us about this order</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <div className="text-center">
        <div className="mx-auto mb-5 grid size-14 place-items-center rounded-full bg-raised">
          <Package className="size-7 text-muted" />
        </div>
        <h1 className="text-2xl font-medium">Track an order</h1>
        <p className="mt-2 text-sm text-muted">
          Enter your order ID and the email used at checkout to see the status of your build.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <label className="block">
          <span className="text-sm text-muted">Order ID</span>
          <Input
            required
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            placeholder="ESO-XXXXXX"
            className="font-mono"
          />
        </label>
        <label className="block">
          <span className="text-sm text-muted">Email</span>
          <Input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@example.com"
            autoComplete="email"
          />
        </label>
        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Looking up…" : "Find my order"}
        </Button>
        <p className="text-center text-xs text-muted">
          Don't have an order ID? <Link to="/contact" className="underline hover:text-paper">Contact us</Link>.
        </p>
      </form>
    </div>
  );
}
