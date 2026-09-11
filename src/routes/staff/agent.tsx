import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import {
  deletePlaybook,
  listMemory,
  listPlaybooks,
  recordMemory,
  runStaffCopilot,
  savePlaybook,
} from "@/lib/es/agent";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";

export const Route = createFileRoute("/staff/agent")({
  component: StaffAgent,
});

function StaffAgent() {
  const qc = useQueryClient();
  const books = useQuery({ queryKey: ["playbooks"], queryFn: listPlaybooks });
  const memory = useQuery({ queryKey: ["agent-memory"], queryFn: () => listMemory(40) });
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [prompt, setPrompt] = useState("");
  const [reply, setReply] = useState("");
  const [pending, setPending] = useState(false);

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

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;
    setPending(true);
    try {
      const out = await runStaffCopilot(prompt.trim());
      setReply(out.reply);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Agent unavailable");
    } finally {
      setPending(false);
    }
  }

  async function teachReply() {
    if (!reply.trim()) return;
    try {
      await recordMemory({ kind: "reply", title: "Staff copilot keep", body: reply.slice(0, 1500), source: "staff" });
      await qc.invalidateQueries({ queryKey: ["agent-memory"] });
      toast.success("Kept as training");
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
          Standing instructions, won crates and staff corrections. The customer agent reads this. The checker still has the last word.
        </p>
      </div>

      <form className="es-card space-y-3 p-5" onSubmit={ask}>
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-esred" />
          <h2 className="font-medium">Workshop copilot</h2>
        </div>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Draft a reply for a junior haptic quote, or suggest a BOM under $15k ex GST…"
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Thinking…" : "Ask"}
          </Button>
          {reply ? (
            <Button type="button" variant="outline" onClick={() => void teachReply()}>
              Keep as training
            </Button>
          ) : null}
        </div>
        {reply ? <p className="whitespace-pre-wrap text-sm text-muted">{reply}</p> : null}
      </form>

      <section className="es-card space-y-4 p-5">
        <h2 className="font-medium">Playbooks</h2>
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
                  <p className="font-medium">{b.title}{b.active ? "" : " · paused"}</p>
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
                  <Button size="sm" variant="ghost" onClick={() => void deletePlaybook(b.id).then(() => qc.invalidateQueries({ queryKey: ["playbooks"] }))}>
                    Remove
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="es-card space-y-3 p-5">
        <h2 className="font-medium">Learned memory</h2>
        <p className="text-xs text-muted">Won builds, good answers and staff keeps. Higher score is reused first.</p>
        <ul className="space-y-2">
          {(memory.data ?? []).length ? (
            memory.data!.map((m) => (
              <li key={m.id} className="rounded-md bg-raised px-4 py-3 text-sm">
                <p className="font-medium">
                  {m.title} <span className="text-xs font-normal text-muted">· {m.kind} · {m.source}</span>
                </p>
                <p className="mt-1 text-muted">{m.body}</p>
              </li>
            ))
          ) : (
            <li className="text-sm text-muted">Nothing learned yet. Win a quote or keep a copilot answer.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
