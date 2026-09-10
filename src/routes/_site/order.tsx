import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PackageSearch } from "lucide-react";
import { lookupOrder, type GuestOrderLookup } from "@/lib/es/server";
import { pageHead } from "@/lib/es/seo";
import { aud } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LineName } from "@/components/es/bits";

export const Route = createFileRoute("/_site/order")({
  head: () =>
    pageHead({
      title: "Track an order | Everything Simulated",
      description: "Look up a Gold Coast sim racing order with your order ID and email.",
      path: "/order",
    }),
  component: OrderLookup,
});

function OrderLookup() {
  const params = useMemo(() => new URLSearchParams(typeof window === "undefined" ? "" : window.location.search), []);
  const [id, setId] = useState(params.get("id") ?? "");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<GuestOrderLookup | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const row = await lookupOrder(id, email);
      setOrder(row);
    } catch (err) {
      setOrder(null);
      toast.error(err instanceof Error ? err.message : "Could not find that order");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-5 py-16">
      <p className="es-kicker">Orders</p>
      <h1 className="mt-3 text-3xl font-medium">Track a crate</h1>
      <p className="mt-3 text-sm text-muted">
        Use the order ID from your confirmation and the email you placed it with. No account needed.
      </p>

      <form onSubmit={onSubmit} className="es-card mt-8 space-y-4 p-5">
        <label className="block text-sm text-muted">
          Order ID
          <Input value={id} onChange={(e) => setId(e.target.value.toUpperCase())} placeholder="ESO-…" required />
        </label>
        <label className="block text-sm text-muted">
          Email
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" required />
        </label>
        <Button type="submit" disabled={busy}>
          <PackageSearch className="size-4" />
          {busy ? "Looking up…" : "Find order"}
        </Button>
      </form>

      {order ? (
        <div className="es-card mt-6 space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">{order.id}</p>
              <p className="text-xs capitalize text-muted">{order.status.replaceAll("_", " ")}</p>
            </div>
            <p className="tabular-nums text-sm">{aud(order.total_ex_gst)} + GST</p>
          </div>
          {order.invoice_number ? <p className="text-sm text-muted">Invoice {order.invoice_number}</p> : null}
          {order.tracking_number ? (
            <p className="text-sm">
              {order.carrier} · {order.tracking_number}
            </p>
          ) : (
            <p className="text-sm text-muted">Tracking is issued once the crate is packed.</p>
          )}
          <ul className="divide-y divide-line rounded-lg border border-line text-sm">
            {(Array.isArray(order.lines) ? order.lines : []).map((line) => (
              <li key={line.sku} className="flex justify-between px-3 py-2">
                <LineName sku={line.sku} />
                <span className="text-muted">× {line.qty}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">
            Questions?{" "}
            <Link to="/contact" className="text-paper underline-offset-4 hover:underline">
              Contact the workshop
            </Link>{" "}
            or{" "}
            <Link to="/login" className="text-paper underline-offset-4 hover:underline">
              Sign In
            </Link>{" "}
            to open a service ticket.
          </p>
        </div>
      ) : null}
    </div>
  );
}
