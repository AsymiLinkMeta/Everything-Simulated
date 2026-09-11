import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Handshake } from "lucide-react";
import {
  CRM_SOURCES,
  CRM_STAGE_LABELS,
  CRM_STAGES,
  staffCreateContact,
  staffListContacts,
  staffSetContactStage,
  type CrmStage,
} from "@/lib/es/crm-oms";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";

export const Route = createFileRoute("/staff/crm")({
  component: CrmHome,
});

function CrmHome() {
  const qc = useQueryClient();
  const people = useQuery({ queryKey: ["crm-contacts"], queryFn: () => staffListContacts() });
  const [view, setView] = useState<"board" | "list">("board");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [postcode, setPostcode] = useState("");
  const [source, setSource] = useState("website");
  const [notes, setNotes] = useState("");

  const rows = useMemo(() => {
    const list = people.data ?? [];
    const query = q.trim().toLowerCase();
    if (!query) return list;
    return list.filter(
      (p) =>
        p.display_name.toLowerCase().includes(query) ||
        (p.email ?? "").toLowerCase().includes(query) ||
        (p.phone ?? "").includes(query) ||
        p.tags.some((t) => t.toLowerCase().includes(query)),
    );
  }, [people.data, q]);

  const due = rows.filter((p) => p.follow_up_at && p.follow_up_at <= new Date().toISOString().slice(0, 10));

  async function create(e: React.FormEvent) {
    e.preventDefault();
    try {
      await staffCreateContact({ displayName, email, phone, postcode, notes, crmSource: source });
      toast.success("Lead created");
      setDisplayName("");
      setEmail("");
      setPhone("");
      setPostcode("");
      setNotes("");
      setOpen(false);
      await qc.invalidateQueries({ queryKey: ["crm-contacts"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create lead");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="es-kicker">CRM</p>
          <h1 className="mt-2 text-3xl font-medium">Pipeline</h1>
          <p className="mt-2 text-sm text-muted">Leads through to active owners. Quotes and orders sit on the 360.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={view === "board" ? "primary" : "outline"} onClick={() => setView("board")}>
            Board
          </Button>
          <Button size="sm" variant={view === "list" ? "primary" : "outline"} onClick={() => setView("list")}>
            List
          </Button>
          <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
            {open ? "Close" : "New lead"}
          </Button>
        </div>
      </div>

      {due.length ? (
        <section className="es-card p-4">
          <p className="es-kicker">Follow-ups due</p>
          <ul className="mt-2 space-y-1 text-sm">
            {due.map((p) => (
              <li key={p.id}>
                <Link to="/staff/crm/$id" params={{ id: p.id }} className="underline">
                  {p.display_name}
                </Link>
                <span className="text-muted"> · {p.follow_up_at}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {open ? (
        <form className="es-card grid gap-3 p-5 sm:grid-cols-2" onSubmit={create}>
          <label className="space-y-1">
            <span className="text-xs text-muted">Name</span>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
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
            <span className="text-xs text-muted">Source</span>
            <select className="es-input" value={source} onChange={(e) => setSource(e.target.value)}>
              {CRM_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted">Postcode</span>
            <Input value={postcode} onChange={(e) => setPostcode(e.target.value)} />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs text-muted">Internal notes</span>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <div className="sm:col-span-2">
            <Button type="submit">Create lead</Button>
          </div>
        </form>
      ) : null}

      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, phone, tag" />

      {people.isPending ? (
        <p className="text-sm text-muted">Loading pipeline…</p>
      ) : view === "board" ? (
        <div className="es-board">
          {CRM_STAGES.map((stage) => {
            const col = rows.filter((p) => p.crm_stage === stage);
            return (
              <section key={stage} className="es-card es-board-col p-4">
                <h2>
                  {CRM_STAGE_LABELS[stage]}
                  <span className="text-muted">{col.length}</span>
                </h2>
                <ul className="space-y-2">
                  {col.map((p) => (
                    <li key={p.id} className="rounded-md bg-raised p-3">
                      <Link to="/staff/crm/$id" params={{ id: p.id }} className="block text-sm font-medium">
                        {p.display_name}
                      </Link>
                      <p className="mt-1 text-xs text-muted">
                        {p.crm_source || "no source"} · {p.email || "no email"}
                      </p>
                      <Link to={`/staff/agent?tool=crm&contact=${p.id}`} className="mt-1 inline-block text-xs text-muted hover:text-paper">
                        Brief
                      </Link>
                      <select
                        className="es-input mt-2"
                        value={stage}
                        aria-label="Move stage"
                        onChange={async (e) => {
                          try {
                            await staffSetContactStage(p.id, e.target.value as CrmStage);
                            await qc.invalidateQueries({ queryKey: ["crm-contacts"] });
                          } catch {
                            toast.error("Could not move");
                          }
                        }}
                      >
                        {CRM_STAGES.map((s) => (
                          <option key={s} value={s}>
                            {CRM_STAGE_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      ) : rows.length ? (
        <ul className="space-y-2">
          {rows.map((p) => (
            <li key={p.id}>
              <Link to="/staff/crm/$id" params={{ id: p.id }} className="es-card block p-4">
                <p className="font-medium">
                  {p.display_name} <span className="text-muted">· {CRM_STAGE_LABELS[p.crm_stage]}</span>
                </p>
                <p className="mt-1 text-sm text-muted">
                  {p.email || "no email"} · {p.phone || "no phone"}
                  {p.follow_up_at ? ` · follow ${p.follow_up_at}` : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="es-card p-6 text-center">
          <Handshake className="mx-auto size-5 text-muted" />
          <p className="mt-2 text-sm text-muted">No contacts yet. Add a lead from a studio booking or walk-in.</p>
        </div>
      )}
    </div>
  );
}
