import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { staffListAmbassadors, staffCreateAmbassador, staffUpdateAmbassador } from "@/lib/es/ambassador-api";
import { staffListOrders } from "@/lib/es/crm-oms";
import { staffListProfiles } from "@/lib/es/server";
import { ambassadorLink, type AmbassadorRecord } from "@/lib/es/ambassadors";
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
      await staffUpdateAmbassador(row.id, { userId: userId || null });
      toast.success("Login attached");
      await qc.invalidateQueries({ queryKey: ["staff-ambassadors"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not attach");
    }
  }

  const refsFor = (code: string) =>
    (orders.data ?? []).filter((o) => (o.notes || "").toUpperCase().includes(`AMBASSADOR CODE: ${code}`));

  return (
    <div className="space-y-6">
      <div>
        <p className="es-kicker">People</p>
        <h1 className="mt-2 text-3xl font-medium">Ambassadors</h1>
        <p className="mt-2 text-sm text-muted">
          Issue a seat and a code. They fill the card. You publish. Checkout stamps the code on the order — not a discount.
        </p>
      </div>

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
          const hits = refsFor(row.code);
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
                  ? `${hits.length} attributed order${hits.length === 1 ? "" : "s"}: ${hits.map((o) => o.id).join(", ")}`
                  : "No attributed checkouts yet."}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
