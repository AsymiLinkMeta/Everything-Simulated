import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CRM_NOTE_KINDS,
  CRM_SOURCES,
  CRM_STAGE_LABELS,
  CRM_STAGES,
  staffGetContact,
  staffLogContactNote,
  staffSetContactStage,
  staffUpdateContact,
  type CrmNoteKind,
  type CrmStage,
} from "@/lib/es/crm-oms";
import { aud } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";

export const Route = createFileRoute("/staff/crm/$id")({
  component: CrmRecord,
});

function CrmRecord() {
  const { id } = Route.useParams() as { id: string };
  const qc = useQueryClient();
  const data = useQuery({ queryKey: ["crm-contact", id], queryFn: () => staffGetContact(id) });
  const p = data.data?.contact;
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [postcode, setPostcode] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [source, setSource] = useState("");
  const [follow, setFollow] = useState("");
  const [tags, setTags] = useState("");
  const [kind, setKind] = useState<CrmNoteKind>("note");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!p) return;
    setDisplayName(p.display_name);
    setEmail(p.email ?? "");
    setPhone(p.phone ?? "");
    setPostcode(p.postcode ?? "");
    setAddress(p.address ?? "");
    setNotes(p.notes ?? "");
    setSource(p.crm_source ?? "");
    setFollow(p.follow_up_at ?? "");
    setTags(p.tags.join(", "));
  }, [p]);

  if (data.isPending) return <p className="text-sm text-muted">Loading customer…</p>;
  if (!p) return <p className="text-sm text-muted">Customer not found.</p>;

  const spend = (data.data?.orders ?? [])
    .filter((o) => o.status !== "cancelled")
    .reduce((s, o) => s + o.total_ex_gst, 0);

  return (
    <div className="space-y-8">
      <div>
        <p className="es-kicker">CRM</p>
        <h1 className="mt-2 text-3xl font-medium">{p.display_name}</h1>
        <p className="mt-1 text-sm text-muted">
          {p.email ?? "no email"} · {aud(spend)} order book
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {CRM_STAGES.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={p.crm_stage === s ? "primary" : "outline"}
            onClick={async () => {
              try {
                await staffSetContactStage(id, s as CrmStage);
                await qc.invalidateQueries({ queryKey: ["crm-contact", id] });
                await qc.invalidateQueries({ queryKey: ["crm-contacts"] });
              } catch {
                toast.error("Could not move");
              }
            }}
          >
            {CRM_STAGE_LABELS[s]}
          </Button>
        ))}
      </div>

      <form
        className="es-card grid gap-3 p-5 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await staffUpdateContact(id, {
              display_name: displayName,
              email,
              phone,
              postcode,
              address,
              notes,
              crm_source: source,
              follow_up_at: follow,
              tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
            });
            toast.success("Customer saved");
            await qc.invalidateQueries({ queryKey: ["crm-contact", id] });
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not save");
          }
        }}
      >
        <label className="space-y-1">
          <span className="text-xs text-muted">Name</span>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted">Email</span>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted">Phone</span>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted">Postcode</span>
          <Input value={postcode} onChange={(e) => setPostcode(e.target.value)} />
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className="text-xs text-muted">Address</span>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted">Source</span>
          <select className="es-input" value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">Unknown</option>
            {CRM_SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted">Follow up</span>
          <Input type="date" value={follow} onChange={(e) => setFollow(e.target.value)} />
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className="text-xs text-muted">Tags</span>
          <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="motion, junior, gold coast" />
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className="text-xs text-muted">Internal notes</span>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <div className="sm:col-span-2">
          <Button type="submit">Save record</Button>
        </div>
      </form>

      <section className="es-card space-y-3 p-5">
        <h2 className="text-lg font-medium">Activity</h2>
        <form
          className="grid gap-2 sm:grid-cols-[8rem_1fr_auto]"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await staffLogContactNote(id, kind, note);
              setNote("");
              toast.success("Logged");
              await qc.invalidateQueries({ queryKey: ["crm-contact", id] });
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Could not log");
            }
          }}
        >
          <select className="es-input" value={kind} onChange={(e) => setKind(e.target.value as CrmNoteKind)}>
            {CRM_NOTE_KINDS.map((k) => (
              <option key={k} value={k}>
                {k.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Call note, visit, follow-up…" required />
          <Button type="submit">Log</Button>
        </form>
        <ul className="space-y-2 text-sm">
          {(data.data?.notes ?? []).length ? (
            data.data?.notes.map((n) => (
              <li key={n.id} className="rounded-md bg-raised px-3 py-2">
                <span className="text-muted">
                  {n.kind.replaceAll("_", " ")} · {new Date(n.created_at).toLocaleString("en-AU")}
                </span>
                <p className="mt-1">{n.body}</p>
              </li>
            ))
          ) : (
            <li className="text-muted">No activity yet.</li>
          )}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-medium">Orders</h2>
        <ul className="mt-3 space-y-2">
          {data.data?.orders.length ? (
            data.data.orders.map((o) => (
              <li key={o.id}>
                <Link to="/staff/oms/$id" params={{ id: o.id }} className="es-card flex justify-between px-4 py-3 text-sm">
                  <span>
                    {o.id} · {o.status}
                  </span>
                  <span className="tabular-nums text-muted">{aud(o.total_ex_gst)}</span>
                </Link>
              </li>
            ))
          ) : (
            <li className="text-sm text-muted">No orders.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
