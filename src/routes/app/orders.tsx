import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listMyOrders } from "@/lib/es/server";
import { aud } from "@/lib/utils";

export const Route = createFileRoute("/app/orders")({
  component: AppOrders,
});

function AppOrders() {
  const orders = useQuery({ queryKey: ["my-orders"], queryFn: () => listMyOrders() });

  return (
    <div className="space-y-6">
      <div>
        <p className="es-kicker">Orders</p>
        <h1 className="mt-2 text-3xl font-medium">Tracking</h1>
        <p className="mt-2 text-sm text-muted">Deposits and crates from your account. Staff mark paid, packed and shipped in OMS.</p>
      </div>
      {orders.isPending ? <p className="text-sm text-muted">Loading…</p> : null}
      {!orders.data?.length && !orders.isPending ? (
        <div className="es-card p-6">
          <p className="text-sm text-muted">No orders yet. Save a quote and place a deposit from the cart.</p>
          <Link to="/shop" className="es-btn mt-4 inline-flex">
            Open shop
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {orders.data?.map((o) => (
            <li key={o.id} className="es-card flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <div>
                <p className="font-medium">{o.id}</p>
                <p className="text-xs text-muted capitalize">
                  {o.status}
                  {o.invoice_number ? ` · ${o.invoice_number}` : ""}
                  {o.tracking_number ? ` · ${o.carrier} ${o.tracking_number}` : ""}
                </p>
              </div>
              <span className="tabular-nums text-muted">{aud(o.total_ex_gst)} ex GST</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
