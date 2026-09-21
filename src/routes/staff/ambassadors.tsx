import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  attributedOrdersForCode,
  commissionBoard,
  staffAttachAmbassadorLogin,
  staffCreateAmbassador,
  staffListAmbassadors,
  staffUpdateAmbassador,
} from "@/lib/es/ambassador-api";
import { staffListOrders } from "@/lib/es/crm-oms";
import { staffListProfiles } from "@/lib/es/server";
import { ambassadorLink, type AmbassadorRecord } from "@/lib/es/ambassadors";
import { aud } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/staff/ambassadors")({
  component: StaffAmbassadors,
});

function StaffAmbassadors() {
  const qc = useQueryClient();
  const rows = useQuery({ queryKey: ["staff-ambassadors"], queryFn: staffListAmbassadors });
  const orders = useQuery({ queryKey: ["staff-orders"], queryFn: staffListOrders });
  const people = useQuery({ queryKey: ["profiles"], queryFn: staffListProfiles });
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [creating, setCreating] = useState(false);

  async function create() {
    if (!name.trim()) {
      toast.error("Name required");
      return;
    }
    setCreating(true);
    try {
      const row = await staffCreateAmbassador({ name, code });
      toast.success(`Seat ${row.code} created`);
      setName("");
      setCode("");
      await qc.invalidateQueries({ queryKey: ["staff-ambassadors"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create. Run the ambassadors migration if the table is missing.");
    } finally {
      setCreating(false);
    }
  }

  async function publish(row: AmbassadorRecord, next: boolean) {
    try {
      await staffUpdateAmbassador(row.id, { published: next });
      toast.success(next ? "Published" : "Unpublished");
      await qc.invalidateQueries({ queryKey: ["staff-ambassadors"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update");
    }
  }

  async function approveGuardian(row: AmbassadorRecord) {
    try {
      await staffUpdateAmbassador(row.id, { guardianApproved: true });
      toast.success("Guardian marked approved");
      await qc.invalidateQueries({ queryKey: ["staff-ambassadors"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update");
    }
  }

  async function attach(row: AmbassadorRecord, userId: string) {
    try {
      await staffAttachAmbassadorLogin(row.id, userId || null);
      toast.success(userId ? "Login attached — they can edit the card in the customer app" : "Login detached");
      await qc.invalidateQueries({ queryKey: ["staff-ambassadors"] });
      await qc.invalidateQueries({ queryKey: ["profiles"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not attach");
    }
  }

  const board = commissionBoard(orders.data ?? [], rows.data ?? []);
  const attributed = board.reduce((n, row) => n + row.count, 0);
  const attributedExGst = board.reduce((n, row) => n + row.attributedExGst, 0);

  return (
    <div className="space-y-6">
      <div>
        <p className="es-kicker">People</p>
        <h1 className="mt-2 text-3xl font-medium">Ambassadors</h1>
        <p className="mt-2 text-sm text-muted">
          Issue a seat and a code. They fill the card. You publish. Checkout stamps the code on the order — not a discount.
          Payouts stay a workshop process off this board.
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <article className="es-card p-5">
          <p className="es-kicker">Seats</p>
          <p className="mt-2 text-2xl font-medium">{rows.data?.length ?? "—"}</p>
          <p className="mt-1 text-xs text-muted">{rows.data?.filter((r) => r.published).length ?? 0} live</p>
        </article>
        <article className="es-card p-5">
          <p className="es-kicker">Attributed crates</p>
          <p className="mt-2 text-2xl font-medium">{orders.isPending ? "—" : attributed}</p>
          <p className="mt-1 text-xs text-muted">Cancelled orders excluded</p>
        </article>
        <article className="es-card p-5">
          <p className="es-kicker">Attributed ex GST</p>
          <p className="mt-2 text-2xl font-medium">{orders.isPending ? "—" : aud(attributedExGst)}</p>
          <p className="mt-1 text-xs text-muted">For commission conversations — not a customer price change</p>
        </article>
      </section>

      {board.some((row) => row.count > 0) ? (
        <section className="es-card overflow-x-auto p-5">
          <h2 className="font-medium">Commission board</h2>
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="py-2 pr-3 font-medium">Ambassador</th>
                <th className="py-2 pr-3 font-medium">Code</th>
                <th className="py-2 pr-3 font-medium">Orders</th>
                <th className="py-2 font-medium">Attributed</th>
              </tr>
            </thead>
            <tbody>
              {board
                .filter((row) => row.count > 0)
                .map((row) => (
                  <tr key={row.code} className="border-t border-line">
                    <td className="py-2 pr-3">{row.name}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{row.code}</td>
                    <td className="py-2 pr-3">{row.count}</td>
                    <td className="py-2">
                      {aud(row.attributedExGst)}
                      <span className="ml-2 text-xs text-muted">{row.orderIds.join(", ")}</span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <section className="es-card space-y-3 p-5">
        <h2 className="font-medium">New seat</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Display name" />
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="CODE (optional)" />
          <Button onClick={create} disabled={creating}>
            {creating ? "Creating…" : "Create seat"}
          </Button>
        </div>
      </section>

      <ul className="space-y-3">
        {rows.isPending ? <li className="text-sm text-muted">Loading…</li> : null}
        {rows.data?.map((row) => {
          const hits = attributedOrdersForCode(orders.data ?? [], row.code);
          return (
            <li key={row.id} className="es-card space-y-3 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{row.name || "Untitled"}</p>
                  <p className="text-xs text-muted">
                    {row.code} · {row.motorsport || "motorsport unset"} · {row.series || "series unset"} ·{" "}
                    {row.published ? "live" : "draft"}
                    {row.under18 ? " · under 18" : ""}
                    {row.under18 && !row.guardianApproved ? " · guardian pending" : ""}
                    {row.userId ? " · login attached" : " · no login"}
                  </p>
                  <p className="mt-1 text-xs text-muted">{ambassadorLink(row.code)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {row.under18 && !row.guardianApproved ? (
                    <Button size="sm" variant="outline" onClick={() => approveGuardian(row)}>
                      Approve guardian
                    </Button>
                  ) : null}
                  <Button size="sm" variant={row.published ? "outline" : "primary"} onClick={() => publish(row, !row.published)}>
                    {row.published ? "Unpublish" : "Publish"}
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted">{row.bio || "No bio yet."}</p>
              <label className="block text-xs text-muted">
                Attach login
                <select
                  className="es-input mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                  value={row.userId ?? ""}
                  onChange={(e) => attach(row, e.target.value)}
                >
                  <option value="">Unattached</option>
                  {(people.data ?? []).map((p) => (
                    <option key={p.user_id} value={p.user_id}>
                      {p.display_name || p.email} · {p.role}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-xs text-muted">
                {hits.length
                  ? `${hits.length} attributed order${hits.length === 1 ? "" : "s"} · ${aud(hits.reduce((n, o) => n + (o.total_ex_gst || 0), 0))} ex GST: ${hits
                      .map((o) => o.id)
                      .join(", ")}`
                  : "No attributed checkouts yet."}
              </p>
              {hits.length ? (
                <p className="text-xs text-muted">
                  Open in OMS:{" "}
                  {hits.slice(0, 4).map((o, i) => (
                    <span key={o.id}>
                      {i ? " · " : ""}
                      <Link to={`/staff/oms/${o.id}`}>{o.id}</Link>
                    </span>
                  ))}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
