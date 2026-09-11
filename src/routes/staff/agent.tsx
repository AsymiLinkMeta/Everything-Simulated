import { createFileRoute, useLocation } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import {
  deleteMemory,
  deletePlaybook,
  listAgentRuns,
  listMemory,
  listPlaybooks,
  recordMemory,
  runStaffAgent,
  savePlaybook,
  scoreMemory,
  STAFF_TOOLS,
  type AgentAction,
  type StaffToolId,
  type StaffTurn,
} from "@/lib/es/agent";
import { getProfile, staffCreateQuote, staffListJobs, staffListQuotes, staffSetJobNotes } from "@/lib/es/server";
import { staffListContacts, staffLogContactNote } from "@/lib/es/crm-oms";
import { fetchProducts } from "@/lib/es/product-cache";
import { CratePreview } from "@/components/es/staff-ask";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";

export const Route = createFileRoute("/staff/agent")({
  component: StaffAgent,
});

function param(search: string, key: string) {
  return new URLSearchParams(search.startsWith("?") ? search : `?${search}`).get(key) ?? "";
}

function StaffAgent() {
  const qc = useQueryClient();
  const location = useLocation();
  const search = typeof location.search === "string" ? location.search : "";
  const profile = useQuery({ queryKey: ["profile"], queryFn: getProfile });
  const isAdmin = profile.data?.role === "admin";
  const books = useQuery({ queryKey: ["playbooks"], queryFn: listPlaybooks });
  const memory = useQuery({ queryKey: ["agent-memory"], queryFn: () => listMemory(40) });
  const runs = useQuery({ queryKey: ["agent-runs"], queryFn: () => listAgentRuns(16) });
  const contacts = useQuery({ queryKey: ["crm-contacts"], queryFn: staffListContacts });
  const quotes = useQuery({ queryKey: ["staff-quotes"], queryFn: staffListQuotes });
  const jobs = useQuery({ queryKey: ["staff-jobs"], queryFn: staffListJobs });
  useQuery({ queryKey: ["products"], queryFn: () => fetchProducts() });

  const [tool, setTool] = useState<StaffToolId>("spec");
  const [contactId, setContactId] = useState("");
  const [quoteId, setQuoteId] = useState("");
  const [jobId, setJobId] = useState("");
  const [ticketId, setTicketId] = useState("");
  const [driver, setDriver] = useState("");
  const [prompt, setPrompt] = useState("");
  const [pending, setPending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [turn, setTurn] = useState<StaffTurn | null>(null);
  const [thread, setThread] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pane, setPane] = useState<"playbooks" | "memory" | "runs">("playbooks");

  useEffect(() => {
    const t = param(search, "tool") as StaffToolId;
    if (STAFF_TOOLS.some((x) => x.id === t)) setTool(t);
    const c = param(search, "contact");
    if (c) setContactId(c);
    const q = param(search, "quote");
    if (q) setQuoteId(q);
    const j = param(search, "job");
    if (j) setJobId(j);
    const tk = param(search, "ticket");
    if (tk) setTicketId(tk);
  }, [search]);

  const activeTool = STAFF_TOOLS.find((t) => t.id === tool) ?? STAFF_TOOLS[0];
  const selectedQuote = useMemo(
    () => quotes.data?.find((q) => q.id === quoteId),
    [quotes.data, quoteId],
  );

  async function ask(message: string) {
    if (!message.trim() || pending) return;
    setPending(true);
    const text = message.trim();
    setThread((prev) => [...prev, { role: "user" as const, content: text }].slice(-8));
    try {
      const next = await runStaffAgent({
        tool,
        message: text,
        lines: selectedQuote?.lines,
        driverWeightKg: driver ? Number(driver) : undefined,
        contactId: contactId || undefined,
        quoteId: quoteId || undefined,
        jobId: jobId ? Number(jobId) : undefined,
        ticketId: ticketId || undefined,
        history: thread,
      });
      setTurn(next);
      setThread((prev) => [...prev, { role: "assistant" as const, content: next.reply }].slice(-8));
      setPrompt("");
      await qc.invalidateQueries({ queryKey: ["agent-runs"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Agent unavailable");
    } finally {
      setPending(false);
    }
  }

  async function applyQuote() {
    if (!turn?.proposedLines.length) return;
    setSaving(true);
    try {
      const saved = await staffCreateQuote({
        lines: turn.proposedLines,
        title: tool === "quote" ? "Staff quote" : "Workshop spec",
        contactId: contactId || undefined,
        driverWeightKg: driver ? Number(driver) : undefined,
      });
      toast.success(`Quote ${saved.id} ${saved.result.ok ? "clear" : "saved as draft"}`);
      await qc.invalidateQueries({ queryKey: ["staff-quotes"] });
      if (contactId) await qc.invalidateQueries({ queryKey: ["crm-contact", contactId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save quote");
    } finally {
      setSaving(false);
    }
  }

  async function applyAction(action: AgentAction) {
    try {
      if (action.type === "note" || action.type === "crm") {
        if (!contactId) throw new Error("Pick a customer first");
        await staffLogContactNote(contactId, "note", action.body);
        toast.success("Logged on the customer");
        await qc.invalidateQueries({ queryKey: ["crm-contact", contactId] });
        return;
      }
      if (action.type === "job_notes" || action.type === "job") {
        if (!jobId) throw new Error("Pick a job first");
        await staffSetJobNotes(Number(jobId), action.body);
        toast.success("Saved on the job");
        await qc.invalidateQueries({ queryKey: ["staff-jobs"] });
        return;
      }
      await recordMemory({ kind: "reply", title: action.title || "Staff keep", body: action.body.slice(0, 1500), source: "staff" });
      toast.success("Kept as training");
      await qc.invalidateQueries({ queryKey: ["agent-memory"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not apply");
    }
  }

  async function keep() {
    if (!turn?.reply) return;
    try {
      await recordMemory({ kind: "reply", title: `Staff ${tool} keep`, body: turn.reply.slice(0, 1500), source: "staff" });
      if (turn.proposedLines.length) {
        await recordMemory({
          kind: "won_bom",
          title: "Staff-kept crate",
          body: turn.proposedLines.map((l) => `${l.qty}× ${l.sku}`).join(", "),
          payload: { lines: turn.proposedLines },
          source: "staff",
        });
      }
      toast.success("Kept as training");
      await qc.invalidateQueries({ queryKey: ["agent-memory"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    }
  }

  async function addBook(e: React.FormEvent) {
    e.preventDefault();
    try {
      await savePlaybook({ title, body });
      setTitle("");
      setBody("");
      await qc.invalidateQueries({ queryKey: ["playbooks"] });
      toast.success("Playbook saved — the agent uses it on the next question");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="es-kicker">Workshop</p>
        <h1 className="mt-2 text-3xl font-medium">Agent</h1>
        <p className="mt-2 text-sm text-muted">
          Spec crates, write quotes, brief customers and jobs. You apply every write. The checker still has the last word.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STAFF_TOOLS.map((t) => (
          <Button
            key={t.id}
            size="sm"
            variant={tool === t.id ? "primary" : "outline"}
            onClick={() => {
              setTool(t.id);
              setTurn(null);
            }}
          >
            {t.label}
          </Button>
        ))}
      </div>

      <form
        className="es-card space-y-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(prompt);
        }}
      >
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 size-4 text-esred" />
          <div>
            <h2 className="font-medium">{activeTool.label}</h2>
            <p className="text-sm text-muted">{activeTool.hint}</p>
            {ticketId ? <p className="text-xs text-muted">Ticket attached</p> : null}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1">
            <span className="text-xs text-muted">Customer</span>
            <select className="es-input w-full" value={contactId} onChange={(e) => setContactId(e.target.value)}>
              <option value="">None</option>
              {(contacts.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.display_name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted">Quote</span>
            <select className="es-input w-full" value={quoteId} onChange={(e) => setQuoteId(e.target.value)}>
              <option value="">None</option>
              {(quotes.data ?? []).map((q) => (
                <option key={q.id} value={q.id}>
                  {q.id} · {q.title}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted">Job</span>
            <select className="es-input w-full" value={jobId} onChange={(e) => setJobId(e.target.value)}>
              <option value="">None</option>
              {(jobs.data ?? []).map((j) => (
                <option key={j.id} value={String(j.id)}>
                  #{j.id} · {j.customer} · {j.stage}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted">Driver kg</span>
            <Input
              type="number"
              min={20}
              max={200}
              value={driver}
              onChange={(e) => setDriver(e.target.value)}
              placeholder="Optional"
            />
          </label>
        </div>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={
            tool === "spec"
              ? "Junior haptic under $12k, 12Nm, Gold Coast demo…"
              : tool === "quote"
                ? "Write a quote for this customer from the current crate…"
                : tool === "fix"
                  ? "Unblock this crate. Keep the wheelbase if you can…"
                  : tool === "reply"
                    ? "Draft a reply — stay in the app, no invented ETAs…"
                    : tool === "crm"
                      ? "What is the next action on this customer?"
                      : "Workshop notes for this job — BOM, holds, crate…"
          }
        />
        <Button type="submit" disabled={pending || !prompt.trim()}>
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Thinking…
            </>
          ) : (
            "Ask"
          )}
        </Button>
        {turn ? (
          <div className="space-y-3 border-t border-line pt-4">
            <p className="whitespace-pre-wrap text-sm text-muted">{turn.reply}</p>
            <CratePreview lines={turn.proposedLines} check={turn.proposedCheck} />
            <div className="flex flex-wrap gap-2">
              {turn.proposedLines.length ? (
                <Button type="button" size="sm" disabled={saving} onClick={() => void applyQuote()}>
                  {saving ? "Saving…" : contactId ? "Save as quote for customer" : "Save quote"}
                </Button>
              ) : null}
              {turn.actions.map((a, i) => (
                <Button key={`${a.type}-${i}`} type="button" size="sm" variant="outline" onClick={() => void applyAction(a)}>
                  {a.type === "job_notes" || a.type === "job"
                    ? "Save job notes"
                    : a.type === "note" || a.type === "crm"
                      ? "Log CRM note"
                      : "Apply"}
                </Button>
              ))}
              <Button type="button" size="sm" variant="outline" onClick={() => void keep()}>
                Keep as training
              </Button>
            </div>
            {turn.followUps.length ? (
              <div className="flex flex-wrap gap-2">
                {turn.followUps.map((f) => (
                  <Button key={f} type="button" size="sm" variant="ghost" onClick={() => void ask(f)}>
                    {f}
                  </Button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </form>

      <div className="flex flex-wrap gap-2">
        {(["playbooks", "memory", "runs"] as const).map((p) => (
          <Button key={p} size="sm" variant={pane === p ? "primary" : "outline"} onClick={() => setPane(p)}>
            {p === "playbooks" ? "Playbooks" : p === "memory" ? "Learned memory" : "Recent runs"}
          </Button>
        ))}
      </div>

      {pane === "playbooks" ? (
        <section className="es-card space-y-4 p-5">
          <h2 className="font-medium">Playbooks</h2>
          <p className="text-xs text-muted">Standing instructions. The customer agent and this desk both read them.</p>
          <form className="grid gap-2 sm:grid-cols-2" onSubmit={addBook}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" required />
            <div className="sm:col-span-2">
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Standing instruction the agent must follow" required />
            </div>
            <Button type="submit">Add playbook</Button>
          </form>
          <ul className="space-y-2">
            {(books.data ?? []).map((b) => (
              <li key={b.id} className="rounded-md bg-raised px-4 py-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {b.title}
                      {b.active ? "" : " · paused"}
                    </p>
                    <p className="mt-1 text-muted">{b.body}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        void savePlaybook({ id: b.id, title: b.title, body: b.body, active: !b.active }).then(() =>
                          qc.invalidateQueries({ queryKey: ["playbooks"] }),
                        )
                      }
                    >
                      {b.active ? "Pause" : "Use"}
                    </Button>
                    {isAdmin ? (
                      <Button size="sm" variant="ghost" onClick={() => void deletePlaybook(b.id).then(() => qc.invalidateQueries({ queryKey: ["playbooks"] }))}>
                        Remove
                      </Button>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {pane === "memory" ? (
        <section className="es-card space-y-3 p-5">
          <h2 className="font-medium">Learned memory</h2>
          <p className="text-xs text-muted">Won builds, good answers and staff keeps. Higher score is reused first.</p>
          <ul className="space-y-2">
            {(memory.data ?? []).length ? (
              memory.data!.map((m) => (
                <li key={m.id} className="rounded-md bg-raised px-4 py-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {m.title}{" "}
                        <span className="text-xs font-normal text-muted">
                          · {m.kind} · {m.source} · {m.score}
                        </span>
                      </p>
                      <p className="mt-1 text-muted">{m.body}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button size="sm" variant="ghost" onClick={() => void scoreMemory(m.id, 1).then(() => qc.invalidateQueries({ queryKey: ["agent-memory"] }))}>
                        +
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => void scoreMemory(m.id, -1).then(() => qc.invalidateQueries({ queryKey: ["agent-memory"] }))}>
                        −
                      </Button>
                      {isAdmin ? (
                        <Button size="sm" variant="ghost" onClick={() => void deleteMemory(m.id).then(() => qc.invalidateQueries({ queryKey: ["agent-memory"] }))}>
                          Remove
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))
            ) : (
              <li className="text-sm text-muted">Nothing learned yet. Win a quote or keep a copilot answer.</li>
            )}
          </ul>
        </section>
      ) : null}

      {pane === "runs" ? (
        <section className="es-card space-y-3 p-5">
          <h2 className="font-medium">Recent runs</h2>
          <ul className="space-y-2">
            {(runs.data ?? []).length ? (
              runs.data!.map((r) => (
                <li key={r.id} className="rounded-md bg-raised px-4 py-3 text-sm">
                  <p className="font-medium capitalize">
                    {r.tool} <span className="text-xs font-normal text-muted">· {new Date(r.created_at).toLocaleString("en-AU")}</span>
                  </p>
                  <p className="mt-1 text-muted">{r.prompt}</p>
                  <p className="mt-1 line-clamp-3">{r.reply}</p>
                </li>
              ))
            ) : (
              <li className="text-sm text-muted">No desk runs yet. Ask above after the SQL is applied.</li>
            )}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
