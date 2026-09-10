import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { askBuilder, listChat, saveQuote } from "@/lib/es/server";
import { createTicket } from "@/lib/es/inbox";
import { useCart } from "@/lib/es/cart-store";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { CheckPills } from "@/components/es/bits";
import { aud, gstInclusive } from "@/lib/utils";

export const Route = createFileRoute("/app/chat")({
  component: Chat,
});

function Chat() {
  const user = useCurrentUser();
  const qc = useQueryClient();
  const lines = useCart((s) => s.lines);
  const driverWeightKg = useCart((s) => s.driverWeightKg);
  const postcode = useCart((s) => s.postcode);
  const result = useCart((s) => s.result)();
  const history = useQuery({ queryKey: ["chat"], queryFn: () => listChat() });
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function runAgent(task: "chat" | "recommend" | "compatibility" | "quote", prompt: string) {
    if (pending) return;
    setPending(true);
    try {
      if (task === "quote") {
        const saved = await saveQuote({ lines, postcode, title: "AI build quote", driverWeightKg });
        const status = saved.result.ok ? "ready to review" : "saved as a draft because the checker found an issue";
        await askBuilder({
          message: `Saved quote ${saved.id}. ${status}. Total ${aud(saved.result.totalExGst)} ex GST.`,
          lines,
          driverWeightKg,
          task: "chat",
        });
      } else {
        await askBuilder({ message: prompt, lines, driverWeightKg, task });
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
          This chat is saved to your account. Staff can read it from the inbox. It never leaves the app.
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
