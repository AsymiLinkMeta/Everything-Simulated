import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listChat, saveQuote } from "@/lib/es/server";
import { createTicket } from "@/lib/es/inbox";
import { rateAgent, runBuildAgent, type AgentTurn } from "@/lib/es/agent";
import { useCart } from "@/lib/es/cart-store";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { CheckPills } from "@/components/es/bits";
import { aud } from "@/lib/utils";

export const Route = createFileRoute("/app/chat")({
  component: Chat,
});

function Chat() {
  const user = useCurrentUser();
  const qc = useQueryClient();
  const lines = useCart((s) => s.lines);
  const setLines = useCart((s) => s.setLines);
  const driverWeightKg = useCart((s) => s.driverWeightKg);
  const postcode = useCart((s) => s.postcode);
  const result = useCart((s) => s.result)();
  const history = useQuery({ queryKey: ["chat"], queryFn: () => listChat() });
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [turn, setTurn] = useState<AgentTurn | null>(null);

  async function runAgent(task: string, prompt: string) {
    if (pending) return;
    setPending(true);
    try {
      if (task === "quote") {
        const saved = await saveQuote({ lines, postcode, title: "AI build quote", driverWeightKg });
        const status = saved.result.ok ? "ready to review" : "saved as a draft because the checker found an issue";
        const next = await runBuildAgent({
          message: `Saved quote ${saved.id}. ${status}. Total ${aud(saved.result.totalExGst)} ex GST. Confirm next steps.`,
          lines,
          driverWeightKg,
          task: "chat",
        });
        setTurn(next);
      } else {
        const next = await runBuildAgent({ message: prompt, lines, driverWeightKg, task });
        setTurn(next);
      }
      await qc.invalidateQueries({ queryKey: ["chat"] });
    } catch {
      toast.error("The build agent could not complete that action.");
    } finally {
      setPending(false);
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() || pending) return;
    const text = message.trim();
    setMessage("");
    await runAgent("chat", text);
  }

  async function askHuman() {
    const snippet = (history.data ?? [])
      .slice(0, 6)
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");
    try {
      await createTicket({
        subject: "Help from expert chat",
        body: snippet || "Customer asked to speak with the workshop.",
        email: user?.email,
        name: user?.displayName,
        kind: "ticket",
      });
      toast.success("Passed to the staff inbox. Continue in Messages.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not pass to workshop");
    }
  }

  const messages = (history.data ?? []).slice().reverse();

  return (
    <div className="flex min-h-[70dvh] flex-col">
      <div className="mb-4">
        <p className="es-kicker">AI Build Agent</p>
        <h1 className="mt-2 text-3xl font-medium">Your build assistant</h1>
        <p className="mt-2 text-sm text-muted">
          It reads the checker, won crates and workshop playbooks. It never invents SKUs. Chat stays on this account.
        </p>
        <div className="mt-3">
          <CheckPills result={result} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => runAgent("recommend", "Recommend the best parts or package for my goals and explain the trade-offs.")}>
            Recommend parts
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => runAgent("compatibility", "Check my current build for compatibility and list the exact changes needed, if any.")}>
            Check compatibility
          </Button>
          <Button type="button" size="sm" disabled={pending} onClick={() => runAgent("quote", "Generate a quote from my current build specification.")}>
            Generate quote
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void askHuman()}>
            Ask the workshop
          </Button>
        </div>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto pb-4">
        {messages.length === 0 ? (
          <p className="text-sm text-muted">Ask about juniors, motion payload, a cheaper Starter swap, or tap a quick action above.</p>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-prose rounded-card px-4 py-3 text-sm ${m.role === "user" ? "ml-auto bg-raised" : "es-card"}`}
            >
              {m.content}
            </div>
          ))
        )}
        {pending ? <p className="text-sm text-muted">Working on your build…</p> : null}
        {turn?.proposedLines.length ? (
          <div className="es-card space-y-3 p-4">
            <p className="text-sm font-medium">Proposed crate</p>
            <ul className="text-sm text-muted">
              {turn.proposedLines.map((l) => (
                <li key={l.sku}>
                  {l.qty} × {l.sku}
                </li>
              ))}
            </ul>
            {turn.proposedCheck ? <CheckPills result={turn.proposedCheck} /> : null}
            <Button
              size="sm"
              onClick={() => {
                setLines(turn.proposedLines);
                toast.success(turn.proposedCheck?.ok ? "Loaded into your build" : "Loaded — checker still has a hold");
              }}
            >
              Apply to cart
            </Button>
          </div>
        ) : null}
        {turn?.followUps.length ? (
          <div className="flex flex-wrap gap-2">
            {turn.followUps.map((q) => (
              <button
                key={q}
                type="button"
                className="rounded-md border border-line px-3 py-1.5 text-xs text-muted hover:text-paper"
                onClick={() => void runAgent("chat", q)}
              >
                {q}
              </button>
            ))}
          </div>
        ) : null}
        {turn?.messageId ? (
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              className="text-muted hover:text-paper"
              onClick={() => void rateAgent({ targetKind: "chat", targetId: turn.messageId, rating: 1, note: turn.reply }).then(() => toast.success("Saved — the agent will reuse this"))}
            >
              Good answer
            </button>
            <button
              type="button"
              className="text-muted hover:text-paper"
              onClick={() => void rateAgent({ targetKind: "chat", targetId: turn.messageId, rating: -1 }).then(() => toast.success("Noted"))}
            >
              Not useful
            </button>
          </div>
        ) : null}
      </div>
      <form className="sticky bottom-20 space-y-2 bg-ink pt-2 md:bottom-0" onSubmit={send}>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Will SR2 fit a TR120S with my 90kg driver?"
          maxLength={4000}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>
            Send
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link to="/app/service">Open messages</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
