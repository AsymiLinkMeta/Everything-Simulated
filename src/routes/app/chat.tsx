import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { askBuilder, listChat } from "@/lib/es/server";
import { useCart } from "@/lib/es/cart-store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { CheckPills } from "@/components/es/bits";

export const Route = createFileRoute("/app/chat")({
  component: Chat,
});

function Chat() {
  const lines = useCart((s) => s.lines);
  const driverWeightKg = useCart((s) => s.driverWeightKg);
  const result = useCart((s) => s.result)();
  const history = useQuery({ queryKey: ["chat"], queryFn: () => listChat() });
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [local, setLocal] = useState<{ role: string; content: string }[]>([]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() || pending) return;
    const text = message.trim();
    setMessage("");
    setLocal((m) => [...m, { role: "user", content: text }]);
    setPending(true);
    try {
      const res = await askBuilder({ message: text, lines, driverWeightKg });
      setLocal((m) => [...m, { role: "assistant", content: res.reply }]);
    } catch {
      setLocal((m) => [...m, { role: "assistant", content: "Could not reach the expert. Try again." }]);
    } finally {
      setPending(false);
    }
  }

  const messages = [...(history.data ?? []).slice().reverse(), ...local];

  return (
    <div className="flex min-h-[70dvh] flex-col">
      <div className="mb-4">
        <p className="es-kicker">Expert</p>
        <h1 className="mt-2 text-3xl font-medium">Build chatbot</h1>
        <p className="mt-2 text-sm text-muted">
          Answers from the checker JSON. It will not invent SKUs or override a block.
        </p>
        <div className="mt-3">
          <CheckPills result={result} />
        </div>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto pb-4">
        {messages.length === 0 ? (
          <p className="text-sm text-muted">Ask about juniors, motion payload, or a cheaper Starter swap.</p>
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
        {pending ? <p className="text-sm text-muted">Checking the spec…</p> : null}
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
