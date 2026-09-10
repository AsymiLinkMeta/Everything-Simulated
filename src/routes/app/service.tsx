import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LifeBuoy } from "lucide-react";
import { createTicket, listMyTickets, replyToTicket } from "@/lib/es/tickets";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";

export const Route = createFileRoute("/app/service")({
  component: AppService,
});

function AppService() {
  const qc = useQueryClient();
  const tickets = useQuery({ queryKey: ["my-tickets"], queryFn: listMyTickets });
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [orderId, setOrderId] = useState("");
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<Record<string, string>>({});

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const ticket = await createTicket({ subject, body, orderId });
      toast.success(`Ticket ${ticket.id} opened`);
      setSubject("");
      setBody("");
      setOrderId("");
      await qc.invalidateQueries({ queryKey: ["my-tickets"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open ticket");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="es-kicker">Support</p>
        <h1 className="mt-2 text-3xl font-medium">Service</h1>
        <p className="mt-2 text-sm text-muted">Workshop questions, crate damage, or a follow-up on an order.</p>
      </div>

      <form onSubmit={onCreate} className="es-card space-y-3 p-5">
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" required />
        <Input value={orderId} onChange={(e) => setOrderId(e.target.value.toUpperCase())} placeholder="Order ID (optional)" />
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="What do you need help with?" required />
        <Button type="submit" disabled={busy}>
          <LifeBuoy className="size-4" />
          {busy ? "Sending…" : "Open ticket"}
        </Button>
      </form>

      {tickets.data?.length ? (
        <ul className="space-y-3">
          {tickets.data.map((t) => (
            <li key={t.id} className="es-card space-y-3 p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{t.subject}</p>
                  <p className="text-xs text-muted">
                    {t.id}
                    {t.order_id ? ` · ${t.order_id}` : ""} · {t.status}
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted whitespace-pre-line">{t.body}</p>
              <form
                className="flex gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const text = (reply[t.id] ?? "").trim();
                  if (!text) return;
                  try {
                    await replyToTicket(t.id, text);
                    setReply((r) => ({ ...r, [t.id]: "" }));
                    toast.success("Reply sent");
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Could not reply");
                  }
                }}
              >
                <Input
                  value={reply[t.id] ?? ""}
                  onChange={(e) => setReply((r) => ({ ...r, [t.id]: e.target.value }))}
                  placeholder="Add a reply"
                />
                <Button type="submit" variant="outline" size="sm">
                  Send
                </Button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">No tickets yet.</p>
      )}
    </div>
  );
}
