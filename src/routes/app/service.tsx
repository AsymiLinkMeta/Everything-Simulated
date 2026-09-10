import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LifeBuoy } from "lucide-react";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import {
  createTicket,
  listMyTickets,
  listTicketMessages,
  replyToTicket,
} from "@/lib/es/inbox";
import { pageHead } from "@/lib/es/seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/app/service")({
  head: () =>
    pageHead({
      title: "Messages | Everything Simulated",
      description: "Talk to the Gold Coast workshop about your build.",
      path: "/app/service",
    }),
  component: ServiceDesk,
});

function ServiceDesk() {
  const user = useCurrentUser();
  const qc = useQueryClient();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [orderId, setOrderId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  const tickets = useQuery({
    queryKey: ["my-tickets"],
    queryFn: listMyTickets,
  });
  const thread = useQuery({
    queryKey: ["ticket-messages", activeId],
    queryFn: () => listTicketMessages(activeId!),
    enabled: Boolean(activeId),
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const ticket = await createTicket({
        subject,
        body,
        orderId,
        email: user?.email,
        name: user?.displayName,
      });
      toast.success("Message sent. It stays in this app — check back any time.");
      setSubject("");
      setBody("");
      setOrderId("");
      setActiveId(ticket.id);
      await qc.invalidateQueries({ queryKey: ["my-tickets"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send.");
    } finally {
      setSubmitting(false);
    }
  }

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!activeId) return;
    try {
      await replyToTicket(activeId, reply);
      setReply("");
      await qc.invalidateQueries({ queryKey: ["ticket-messages", activeId] });
      await qc.invalidateQueries({ queryKey: ["my-tickets"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reply.");
    }
  }

  const active = tickets.data?.find((t) => t.id === activeId);
  const messages = thread.data ?? [];

  return (
    <div className="space-y-8">
      <div>
        <p className="es-kicker">Workshop</p>
        <h1 className="mt-2 text-3xl font-medium">Messages</h1>
        <p className="mt-2 text-sm text-muted">
          Everything stays in your account. Staff reply here — nothing is sent off-site.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="es-card space-y-4 p-5">
          <h2 className="font-medium">New message</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="text-sm text-muted">Subject *</span>
              <Input required value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Wheel base issue" />
            </label>
            <label className="block">
              <span className="text-sm text-muted">Order ID (optional)</span>
              <Input value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="ESO-XXXXXX" className="font-mono" />
            </label>
            <label className="block">
              <span className="text-sm text-muted">Message *</span>
              <textarea
                required
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Describe your question or issue…"
                className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-paper placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </label>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Sending…" : "Send to workshop"}
            </Button>
          </form>
        </div>

        <div className="space-y-4">
          <h2 className="font-medium">Your threads</h2>
          {tickets.isPending ? (
            <div className="es-card p-5 text-sm text-muted">Loading…</div>
          ) : !tickets.data?.length ? (
            <div className="es-card p-6 text-center">
              <LifeBuoy className="mx-auto size-5 text-muted" />
              <p className="mt-2 text-sm text-muted">No messages yet. They’ll stay here after you sign out.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {tickets.data.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className={`es-card w-full p-4 text-left ${activeId === t.id ? "ring-1 ring-accent" : ""}`}
                    onClick={() => setActiveId(t.id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{t.subject}</p>
                      <span className="text-xs capitalize text-muted">{t.status}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {new Date(t.updated_at || t.created_at).toLocaleString("en-AU")}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {active ? (
        <section className="es-card space-y-4 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-medium">{active.subject}</h2>
              <p className="text-xs text-muted">
                {active.order_id ? `${active.order_id} · ` : ""}
                {active.status}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setActiveId(null)}>
              Close
            </Button>
          </div>
          <div className="space-y-3">
            {messages.length === 0 ? (
              <p className="rounded-lg bg-raised p-3 text-sm">{active.body}</p>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-prose rounded-lg px-4 py-3 text-sm ${
                    m.author_role === "customer" ? "ml-auto bg-raised" : "bg-surface"
                  }`}
                >
                  <p className="text-xs capitalize text-muted">{m.author_role}</p>
                  <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
                </div>
              ))
            )}
          </div>
          <form className="flex flex-col gap-2" onSubmit={sendReply}>
            <textarea
              rows={3}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Reply to the workshop…"
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-paper placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <Button type="submit" disabled={!reply.trim()}>
              Send reply
            </Button>
          </form>
        </section>
      ) : null}

      <Link to="/app/orders" className="block text-sm text-muted hover:text-paper">
        View your orders →
      </Link>
    </div>
  );
}
