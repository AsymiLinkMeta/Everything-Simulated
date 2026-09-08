import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { askBuilder, listChat, saveQuote } from "@/lib/es/server";
import { useCart } from "@/lib/es/cart-store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { CheckPills } from "@/components/es/bits";
import { aud, gstInclusive } from "@/lib/utils";

export const Route = createFileRoute("/app/chat")({
  component: Chat,
});

function Chat() {
  const lines = useCart((s) => s.lines);
  const driverWeightKg = useCart((s) => s.driverWeightKg);
  const postcode = useCart((s) => s.postcode);
  const result = useCart((s) => s.result)();
  const history = useQuery({ queryKey: ["chat"], queryFn: () => listChat() });
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [local, setLocal] = useState<{ role: string; content: string }[]>([]);

  async function runAgent(task: "chat" | "recommend" | "compatibility" | "quote", prompt: string) {
    if (pending) return;
    setLocal((m) => [...m, { role: "user", content: prompt }]);
    setPending(true);
    try {
      if (task === "quote") {
        const saved = await saveQuote({ data: { lines, postcode, title: "AI build quote", driverWeightKg } });
        const status = saved.result.ok ? "ready to review" : "saved as a draft because the checker found an issue";
        setLocal((m) => [
          ...m,
          {
            role: "assistant",
            content: `Quote ${saved.id} is ${status}. Total is ${aud(saved.result.totalExGst)} ex GST (${aud(gstInclusive(saved.result.totalExGst))} inc GST), with an estimated ${saved.result.leadWeeks[0]}–${saved.result.leadWeeks[1]} week lead time.`,
          },
        ]);
      } else {
        const res = await askBuilder({ message: prompt, lines, driverWeightKg, task });
        setLocal((m) => [...m, { role: "assistant", content: res.reply }]);
      }
    } catch {
      setLocal((m) => [...m, { role: "assistant", content: "The build agent could not complete that action. Please try again." }]);
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

  const messages = [...(history.data ?? []).slice().reverse(), ...local];

  return (
    <div className="flex min-h-[70dvh] flex-col">
      <div className="mb-4">
        <p className="es-kicker">AI Build Agent</p>
        <h1 className="mt-2 text-3xl font-medium">Your build assistant</h1>
        <p className="mt-2 text-sm text-muted">
          Get part recommendations, compatibility advice, and quotes from your live build spec. The agent only references real catalogue parts and never overrides a checker block.
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
        <Button type="submit" disabled={pending}>
          Send
        </Button>
      </form>
    </div>
  );
}
