import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { fetchProducts } from "@/lib/es/product-cache";
import {
  ORDER_STATUSES,
  staffAssignTracking,
  staffEmailOrder,
  staffGetOrder,
  staffRefundPayment,
  staffReturnOrder,
  staffSetOrderStatus,
  staffUpdateOrderShipping,
  type OrderStatus,
} from "@/lib/es/crm-oms";
import { aud } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";

export const Route = createFileRoute("/staff/oms/$id")({
  component: OmsOrder,
});

function OmsOrder() {
  const { id } = Route.useParams() as { id: string };
  const qc = useQueryClient();
  const order = useQuery({ queryKey: ["oms-order", id], queryFn: () => staffGetOrder(id) });
  const catalog = useQuery({ queryKey: ["products"], queryFn: () => fetchProducts() });
  const o = order.data;
  const [tracking, setTracking] = useState("");
  const [carrier, setCarrier] = useState("ES Crate Freight");
  const [shippingName, setShippingName] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [postcode, setPostcode] = useState("");
  const [notes, setNotes] = useState("");
  const [returnReason, setReturnReason] = useState("");

  useEffect(() => {
    if (!o) return;
    setCarrier(o.carrier || "ES Crate Freight");
    setShippingName(o.shipping_name ?? "");
    setShippingAddress(o.shipping_address ?? "");
    setPostcode(o.postcode ?? "");
    setNotes(o.notes ?? "");
  }, [o]);

  if (order.isPending) return <p className="text-sm text-muted">Loading order…</p>;
  if (!o) return <p className="text-sm text-muted">Order not found.</p>;

  const products = catalog.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <p className="es-kicker">OMS</p>
        <h1 className="mt-2 text-3xl font-medium">{o.id}</h1>
        <p className="mt-1 text-sm text-muted">
          {o.contact_name ?? "Customer"} · {aud(o.total_ex_gst)} ex GST · {aud(o.total_inc_gst)} inc GST
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {ORDER_STATUSES.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={o.status === s ? "primary" : "outline"}
            onClick={async () => {
              try {
                await staffSetOrderStatus(o.id, s as OrderStatus);
                await qc.invalidateQueries({ queryKey: ["oms-order", id] });
                await qc.invalidateQueries({ queryKey: ["oms-orders"] });
              } catch {
                toast.error("Could not update status");
              }
            }}
          >
            {s}
          </Button>
        ))}
      </div>

      <section className="es-card space-y-3 p-5" id="invoice">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-medium">GST invoice</h2>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            Print
          </Button>
        </div>
        <p className="text-sm">
          {o.invoice_number ?? "Issue by marking paid."} · Everything Simulated · {o.shipping_name ?? "Customer"}
        </p>
        <p className="text-sm tabular-nums">
          {aud(o.total_ex_gst)} ex GST · {aud(o.total_inc_gst)} inc GST (10%)
          {o.paid_cents ? ` · paid ${aud(o.paid_cents)}` : ""}
          {o.refunded_cents ? ` · refunded ${aud(o.refunded_cents)}` : ""}
        </p>
        <p className="text-xs text-muted">Australian tax invoice. Crate freight from the Gold Coast.</p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              try {
                await staffEmailOrder(o.id, o.invoice_number ? "paid" : "placed");
                toast.success("Email queued");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not email");
              }
            }}
          >
            Email invoice
          </Button>
          {o.stripe_payment_intent && (o.paid_cents ?? 0) > (o.refunded_cents ?? 0) ? (
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  const res = await staffRefundPayment(o.id);
                  toast.success(`Refunded ${aud(res.refunded)}`);
                  await qc.invalidateQueries({ queryKey: ["oms-order", id] });
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Refund failed");
                }
              }}
            >
              Refund Stripe
            </Button>
          ) : null}
        </div>
      </section>

      <section className="es-card space-y-3 p-5">
        <table className="es-pick">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Item</th>
              <th>Qty</th>
            </tr>
          </thead>
          <tbody>
            {o.lines.map((line) => {
              const p = products.find((item) => item.sku === line.sku);
              return (
                <tr key={line.sku}>
                  <td>{line.sku}</td>
                  <td>{p ? `${p.brand} ${p.name}` : line.sku}</td>
                  <td>{line.qty}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="es-card space-y-3 p-5">
        <h2 className="text-lg font-medium">Tracking</h2>
        <p className="text-sm text-muted">
          {o.tracking_number ? `${o.carrier} · ${o.tracking_number}` : "No crate number yet."}
          {o.invoice_number ? ` · ${o.invoice_number}` : ""}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs text-muted">Tracking number</span>
            <Input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Blank to auto-issue" />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted">Carrier</span>
            <Input value={carrier} onChange={(e) => setCarrier(e.target.value)} />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={async () => {
            try {
              const res = await staffAssignTracking(o.id, tracking || undefined, carrier);
              toast.success(res.tracking);
              setTracking("");
              await qc.invalidateQueries({ queryKey: ["oms-order", id] });
            } catch {
              toast.error("Could not assign tracking");
            }
          }}
        >
          {o.tracking_number ? "Update tracking" : "Issue tracking"}
        </Button>
        {o.tracking_number ? (
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              try {
                await staffEmailOrder(o.id, "tracking");
                toast.success("Tracking email queued");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not email");
              }
            }}
          >
            Email tracking
          </Button>
        ) : null}
        </div>
      </section>

      <section className="es-card space-y-3 p-5">
        <h2 className="text-lg font-medium">Ship to</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs text-muted">Name</span>
            <Input value={shippingName} onChange={(e) => setShippingName(e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted">Postcode</span>
            <Input value={postcode} onChange={(e) => setPostcode(e.target.value)} />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs text-muted">Address</span>
            <Input value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs text-muted">Internal notes</span>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={async () => {
              try {
                await staffUpdateOrderShipping(o.id, {
                  shipping_name: shippingName,
                  shipping_address: shippingAddress,
                  postcode,
                  notes,
                });
                toast.success("Shipping saved");
                await qc.invalidateQueries({ queryKey: ["oms-order", id] });
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not save");
              }
            }}
          >
            Save shipping
          </Button>
          {o.contact_id ? (
            <Button asChild size="sm" variant="outline">
              <Link to="/staff/crm/$id" params={{ id: o.contact_id }}>
                Open CRM
              </Link>
            </Button>
          ) : null}
        </div>
      </section>

      <section className="es-card space-y-3 p-5">
        <h2 className="text-lg font-medium">Return / cancel</h2>
        {o.return_reason ? <p className="text-sm">Reason on file: {o.return_reason}</p> : null}
        <Textarea value={returnReason} onChange={(e) => setReturnReason(e.target.value)} placeholder="Reason" />
        <Button
          type="button"
          variant="outline"
          disabled={o.status === "cancelled"}
          onClick={async () => {
            try {
              await staffReturnOrder(o.id, returnReason);
              toast.success("Order cancelled");
              await qc.invalidateQueries({ queryKey: ["oms-order", id] });
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Could not return");
            }
          }}
        >
          Process return
        </Button>
      </section>
    </div>
  );
}
