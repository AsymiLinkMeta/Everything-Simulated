import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import {
  recordMemory,
  runStaffAgent,
  skuLabel,
  type AgentAction,
  type StaffToolId,
  type StaffTurn,
} from "@/lib/es/agent";
import { staffCreateQuote, staffSetJobNotes } from "@/lib/es/server";
import { staffLogContactNote } from "@/lib/es/crm-oms";
import { fetchProducts } from "@/lib/es/product-cache";
import { CheckPills } from "@/components/es/bits";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { aud } from "@/lib/utils";
import type { CartLine } from "@/lib/es/types";

export function CratePreview({
  lines,
  check,
}: {
  lines: CartLine[];
  check: StaffTurn["proposedCheck"];
}) {
  if (!lines.length) return null;
  return (
    <div className="space-y-2">
      <ul className="space-y-1 text-sm">
        {lines.map((l) => (
          <li key={l.sku} className="flex justify-between gap-3">
            <span>
              {l.qty} × {skuLabel(l.sku)}
            </span>
            <span className="text-xs text-muted">{l.sku}</span>
          </li>
        ))}
      </ul>
      {check ? (
        <div className="flex flex-wrap items-center gap-2">
          <CheckPills result={check} />
          <span className="text-xs text-muted">{aud(check.totalExGst)} ex GST</span>
        </div>
      ) : null}
    </div>
  );
}

export function StaffAsk({
  tool,
  contactId,
  quoteId,
  jobId,
  ticketId,
  lines,
  extra,
  title,
  placeholder,
}: {
  tool: StaffToolId;
  contactId?: string;
  quoteId?: string;
  jobId?: number;
  ticketId?: string;
  lines?: CartLine[];
  extra?: string;
  title?: string;
  placeholder?: string;
}) {
  const qc = useQueryClient();
  useQuery({ queryKey: ["products"], queryFn: () => fetchProducts() });
  const [prompt, setPrompt] = useState("");
  const [pending, setPending] = useState(false);
  const [turn, setTurn] = useState<StaffTurn | null>(null);
  const [saving, setSaving] = useState(false);

  async function ask(message: string) {
    if (!message.trim() || pending) return;
    setPending(true);
    try {
      const next = await runStaffAgent({
        tool,
        message: message.trim(),
        lines,
        contactId,
        quoteId,
        jobId,
        ticketId,
        extra,
        history: turn ? [{ role: "assistant", content: turn.reply }] : [],
      });
      setTurn(next);
      setPrompt("");
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
        contactId,
      });
      toast.success(`Quote ${saved.id} ${saved.result.ok ? "clear" : "saved as draft"}`);
      await qc.invalidateQueries({ queryKey: ["staff-quotes"] });
      await qc.invalidateQueries({ queryKey: ["crm-contacts"] });
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
        await staffSetJobNotes(jobId, action.body);
        toast.success("Saved on the job");
        await qc.invalidateQueries({ queryKey: ["staff-jobs"] });
        return;
      }
      await recordMemory({
        kind: "reply",
        title: action.title || "Staff keep",
        body: action.body.slice(0, 1500),
        source: "staff",
      });
      toast.success("Kept as training");
      await qc.invalidateQueries({ queryKey: ["agent-memory"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not apply");
    }
  }

  async function keep() {
    if (!turn?.reply) return;
    try {
      await recordMemory({
        kind: "reply",
        title: `Staff ${tool} keep`,
        body: turn.reply.slice(0, 1500),
        source: "staff",
      });
      toast.success("Kept as training");
      await qc.invalidateQueries({ queryKey: ["agent-memory"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    }
  }

  return (
    <section className="es-card space-y-3 p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-esred" />
        <h2 className="font-medium">{title ?? "Agent"}</h2>
      </div>
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(prompt);
        }}
      >
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={placeholder ?? "Ask the workshop agent…"}
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
      </form>
      {turn ? (
        <div className="space-y-3">
          <p className="whitespace-pre-wrap text-sm text-muted">{turn.reply}</p>
          <CratePreview lines={turn.proposedLines} check={turn.proposedCheck} />
          <div className="flex flex-wrap gap-2">
            {turn.proposedLines.length ? (
              <Button size="sm" disabled={saving} onClick={() => void applyQuote()}>
                {saving ? "Saving…" : contactId ? "Save as quote" : "Save quote"}
              </Button>
            ) : null}
            {turn.actions.map((a, i) => (
              <Button key={`${a.type}-${i}`} size="sm" variant="outline" onClick={() => void applyAction(a)}>
                {a.type === "job_notes" || a.type === "job" ? "Save job notes" : a.type === "note" || a.type === "crm" ? "Log CRM note" : "Apply"}
              </Button>
            ))}
            <Button size="sm" variant="outline" onClick={() => void keep()}>
              Keep as training
            </Button>
          </div>
          {turn.followUps.length ? (
            <div className="flex flex-wrap gap-2">
              {turn.followUps.map((f) => (
                <Button key={f} size="sm" variant="ghost" onClick={() => void ask(f)}>
                  {f}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
