import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Truck } from "lucide-react";
import { fetchProducts } from "@/lib/es/product-cache";
import { staffListQuotes } from "@/lib/es/server";
import {
  ORDER_STATUSES,
  staffAssignTracking,
  staffCreateOrder,
  staffListContacts,
  staffListOrders,
  staffSetOrderStatus,
} from "@/lib/es/crm-oms";
import type { CartLine } from "@/lib/es/types";
import { aud } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/staff/oms")({
  component: OmsHome,
});

function OmsHome() {
  const qc = useQueryClient();
  const orders = useQuery({ queryKey: ["oms-orders"], queryFn: () => staffListOrders() });
  const contacts = useQuery({ queryKey: ["crm-contacts"], queryFn: () => staffListContacts() });
  const quotes = useQuery({ queryKey: ["staff-quotes"], queryFn: () => staffListQuotes() });
  const catalog = useQuery({ queryKey: ["products"], queryFn: () => fetchProducts() });
  const [view, setView] = useState<"board" | "list">("board");
  const [open, setOpen] = useState(false);
  const [contactId, setContactId] = useState("");
  const [quoteId, setQuoteId] = useState("");
  const [sku, setSku] = useState("");
  const [qty, setQty] = useState("1");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const list = orders.data ?? [];
    const query = q.trim().toLowerCase();
    if (!query) return list;
    return list.filter(
      (o) =>
        o.id.toLowerCase().includes(query) ||
        (o.tracking_number ?? "").toLowerCase().includes(query) ||
        (o.invoice_number ?? "").toLowerCase().includes(query) ||
        (o.contact_name ?? "").toLowerCase().includes(query),
    );
  }, [orders.data, q]);

  async function create() {
    if (!contactId) {
      toast.error("Pick a customer");
      return;
    }
    try {
      const res = await staffCreateOrder({
        contactId,
        quoteId: quoteId || undefined,
        lines: lines.length ? lines : undefined,
      });
      toast.success(`Order ${res.id} created`);
      setLines([]);
      setQuoteId("");
      await qc.invalidateQueries({ queryKey: ["oms-orders"] });
      await qc.invalidateQueries({ queryKey: ["crm-contacts"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create order");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="es-kicker">OMS</p>
          <h1 className="mt-2 text-3xl font-medium">Fulfillment</h1>
          <p className="mt-2 text-sm text-muted">Quote to crate. Pack, invoice, track and deliver.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={view === "board" ? "primary" : "outline"} onClick={() => setView("board")}>
            Board
          </Button>
          <Button size="sm" variant={view === "list" ? "primary" : "outline"} onClick={() => setView("list")}>
            List
          </Button>
          <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
            {open ? "Close composer" : "New order"}
          </Button>
        </div>
      </div>

      {open ? (
        <section className="es-card space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs text-muted">Customer</span>
              <select className="es-input" value={contactId} onChange={(e) => setContactId(e.target.value)}>
                <option value="">Select</option>
                {(contacts.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.display_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted">From quote (optional)</span>
              <select className="es-input" value={quoteId} onChange={(e) => setQuoteId(e.target.value)}>
                <option value="">None — pick lines</option>
                {(quotes.data ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.id} · {item.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <select className="es-input max-w-sm" value={sku} onChange={(e) => setSku(e.target.value)}>
              <option value="">Add SKU</option>
              {(catalog.data ?? []).map((p) => (
                <option key={p.sku} value={p.sku}>
                  {p.sku} · {p.brand} {p.name}
                </option>
              ))}
            </select>
            <Input className="w-20" value={qty} onChange={(e) => setQty(e.target.value)} />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!sku) return;
                const n = Math.max(1, Number(qty) || 1);
                setLines((prev) => {
                  const hit = prev.find((l) => l.sku === sku);
                  if (hit) return prev.map((l) => (l.sku === sku ? { ...l, qty: l.qty + n } : l));
                  return [...prev, { sku, qty: n }];
                });
                setSku("");
              }}
            >
              Add line
            </Button>
          </div>
          {lines.length ? (
            <ul className="text-sm text-muted">
              {lines.map((l) => (
                <li key={l.sku}>
                  {l.qty} × {l.sku}{" "}
                  <button type="button" className="underline" onClick={() => setLines((prev) => prev.filter((x) => x.sku !== l.sku))}>
                    remove
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <Button type="button" onClick={create}>
            Create order
          </Button>
        </section>
      ) : null}

      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search id, invoice, tracking, name" />

      {orders.isPending ? (
        <p className="text-sm text-muted">Loading orders…</p>
      ) : view === "board" ? (
        <div className="es-board">
          {ORDER_STATUSES.filter((s) => s !== "cancelled").map((col) => {
            const items = filtered.filter((o) => o.status === col);
            return (
              <section key={col} className="es-card es-board-col p-4">
                <h2>
                  {col}
                  <span className="text-muted">{items.length}</span>
                </h2>
                <ul className="space-y-2">
                  {items.map((o) => (
                    <li key={o.id} className="rounded-md bg-raised p-3 text-sm">
                      <Link to="/staff/oms/$id" params={{ id: o.id }} className="font-medium">
                        {o.id}
                      </Link>
                      <p className="mt-1 text-xs text-muted">
                        {o.contact_name ?? "—"} · {aud(o.total_ex_gst)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {col === "pending" ? (
                          <Button size="sm" variant="outline" onClick={() => staffSetOrderStatus(o.id, "paid").then(() => qc.invalidateQueries({ queryKey: ["oms-orders"] }))}>
                            Mark paid
                          </Button>
                        ) : null}
                        {col === "paid" ? (
                          <Button size="sm" variant="outline" onClick={() => staffSetOrderStatus(o.id, "packing").then(() => qc.invalidateQueries({ queryKey: ["oms-orders"] }))}>
                            Pack
                          </Button>
                        ) : null}
                        {col === "packing" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              try {
                                if (!o.tracking_number) await staffAssignTracking(o.id);
                                await staffSetOrderStatus(o.id, "shipped");
                                await qc.invalidateQueries({ queryKey: ["oms-orders"] });
                              } catch (err) {
                                toast.error(err instanceof Error ? err.message : "Could not ship");
                              }
                            }}
                          >
                            Ship
                          </Button>
                        ) : null}
                        {col === "shipped" ? (
                          <Button size="sm" variant="outline" onClick={() => staffSetOrderStatus(o.id, "delivered").then(() => qc.invalidateQueries({ queryKey: ["oms-orders"] }))}>
                            Delivered
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      ) : filtered.length ? (
        <ul className="space-y-2">
          {filtered.map((o) => (
            <li key={o.id} className="es-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {o.id} · {o.status}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {o.contact_name} · {aud(o.total_ex_gst)}
                    {o.tracking_number ? ` · ${o.tracking_number}` : " · no tracking"}
                  </p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link to="/staff/oms/$id" params={{ id: o.id }}>
                    Open
                  </Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="es-card p-6 text-center">
          <Truck className="mx-auto size-5 text-muted" />
          <p className="mt-2 text-sm text-muted">No orders yet. Convert a quote or compose one for a customer.</p>
        </div>
      )}
    </div>
  );
}
