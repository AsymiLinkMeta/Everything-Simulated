import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Inbox } from "lucide-react";
import {
  listInbox,
  listTicketMessages,
  markInboxRead,
  replyToTicket,
  setTicketStatus,
  staffGetChat,
  staffListChats,
  staffListTickets,
  type InboxItem,
} from "@/lib/es/inbox";
import { draftStaffReply, recordMemory } from "@/lib/es/agent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/staff/service")({
  component: StaffInbox,
});

function StaffInbox() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"inbox" | "tickets" | "expert">("inbox");
  const [activeTicket, setActiveTicket] = useState<string | null>(null);
  const [chatUser, setChatUser] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [drafting, setDrafting] = useState(false);

  const inbox = useQuery({ queryKey: ["staff-inbox"], queryFn: listInbox, refetchInterval: 15000 });
  const tickets = useQuery({ queryKey: ["staff-tickets"], queryFn: staffListTickets });
  const chats = useQuery({ queryKey: ["staff-chats"], queryFn: staffListChats, enabled: tab === "expert" });
  const thread = useQuery({
    queryKey: ["ticket-messages", activeTicket],
    queryFn: () => listTicketMessages(activeTicket!),
    enabled: Boolean(activeTicket),
  });
  const chat = useQuery({
    queryKey: ["staff-chat", chatUser],
    queryFn: () => staffGetChat(chatUser!),
    enabled: Boolean(chatUser),
  });

  async function openInbox(item: InboxItem) {
    if (!item.read_at) {
      await markInboxRead(item.id);
      await qc.invalidateQueries({ queryKey: ["staff-inbox"] });
      await qc.invalidateQueries({ queryKey: ["inbox-unread"] });
    }
    if (item.ticket_id) {
      setActiveTicket(item.ticket_id);
      setTab("tickets");
    }
  }

  const unread = inbox.data?.filter((i) => !i.read_at).length ?? 0;
  const active = tickets.data?.find((t) => t.id === activeTicket);

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!activeTicket) return;
    try {
      await replyToTicket(activeTicket, reply);
      setReply("");
      await qc.invalidateQueries({ queryKey: ["ticket-messages", activeTicket] });
      await qc.invalidateQueries({ queryKey: ["staff-tickets"] });
      toast.success("Reply saved in the customer app");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reply");
    }
  }

  async function draftReply() {
    if (!activeTicket || !active) return;
    setDrafting(true);
    try {
      const threadText = (thread.data ?? []).map((m) => `${m.author_role}: ${m.body}`).join("\n");
      const text = await draftStaffReply({
        subject: active.subject,
        thread: threadText || active.subject,
        extra: [active.contact_name, active.contact_email, active.order_id].filter(Boolean).join(" · "),
      });
      setReply(text);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not draft a reply");
    } finally {
      setDrafting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="es-kicker">Admin</p>
        <h1 className="mt-2 text-3xl font-medium">Inbox</h1>
        <p className="mt-1 text-sm text-muted">
          All mail, tickets and workshop messages land here. Customers keep the same thread in their app.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={tab === "inbox" ? "primary" : "outline"} onClick={() => setTab("inbox")}>
          Inbox{unread ? ` (${unread})` : ""}
        </Button>
        <Button size="sm" variant={tab === "tickets" ? "primary" : "outline"} onClick={() => setTab("tickets")}>
          Tickets
        </Button>
        <Button size="sm" variant={tab === "expert" ? "primary" : "outline"} onClick={() => setTab("expert")}>
          Expert chats
        </Button>
      </div>

      {tab === "inbox" ? (
        inbox.isPending ? (
          <p className="text-sm text-muted">Loading inbox…</p>
        ) : !inbox.data?.length ? (
          <div className="es-card p-6 text-center">
            <Inbox className="mx-auto size-5 text-muted" />
            <p className="mt-2 text-sm text-muted">Nothing yet. New orders, contact forms and tickets appear here.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {inbox.data.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`es-card w-full p-4 text-left ${item.read_at ? "" : "ring-1 ring-accent"}`}
                  onClick={() => void openInbox(item)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{item.subject}</p>
                    <span className="text-xs capitalize text-muted">{item.kind}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{item.body}</p>
                  <p className="mt-1 text-xs text-muted">
                    {item.from_name || item.from_email || "System"} ·{" "}
                    {new Date(item.created_at).toLocaleString("en-AU")}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}

      {tab === "tickets" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <ul className="space-y-2">
            {(tickets.data ?? []).map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className={`es-card w-full p-4 text-left ${activeTicket === t.id ? "ring-1 ring-accent" : ""}`}
                  onClick={() => setActiveTicket(t.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{t.subject}</p>
                    <span className="text-xs capitalize text-muted">{t.status}</span>
                  </div>
                  <p className="text-xs text-muted">
                    {t.contact_name || t.contact_email}
                    {t.order_id ? ` · ${t.order_id}` : ""}
                  </p>
                </button>
              </li>
            ))}
          </ul>
          {active ? (
            <section className="es-card space-y-4 p-5">
              <div>
                <h2 className="font-medium">{active.subject}</h2>
                <p className="text-xs text-muted">
                  {active.contact_name} · {active.contact_email}
                  {active.order_id ? (
                    <>
                      {" · "}
                      <Link to="/staff/oms/$id" params={{ id: active.order_id }}>
                        {active.order_id}
                      </Link>
                    </>
                  ) : null}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(["open", "pending", "resolved", "closed"] as const).map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={active.status === s ? "primary" : "outline"}
                    onClick={async () => {
                      await setTicketStatus(active.id, s);
                      await qc.invalidateQueries({ queryKey: ["staff-tickets"] });
                    }}
                  >
                    {s}
                  </Button>
                ))}
              </div>
              <div className="space-y-3">
                {(thread.data ?? []).map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-lg px-4 py-3 text-sm ${m.author_role === "staff" ? "bg-raised" : "bg-surface"}`}
                  >
                    <p className="text-xs capitalize text-muted">{m.author_role}</p>
                    <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
                  </div>
                ))}
              </div>
              <form className="space-y-2" onSubmit={sendReply}>
                <Input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply in the customer app…" />
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={!reply.trim()}>
                    Send to customer app
                  </Button>
                  <Button type="button" variant="outline" disabled={drafting} onClick={() => void draftReply()}>
                    {drafting ? "Drafting…" : "Draft reply"}
                  </Button>
                </div>
              </form>
            </section>
          ) : (
            <p className="text-sm text-muted">Select a ticket.</p>
          )}
        </div>
      ) : null}

      {tab === "expert" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <ul className="space-y-2">
            {(chats.data ?? []).map((c) => (
              <li key={c.user_id}>
                <button
                  type="button"
                  className={`es-card w-full p-4 text-left ${chatUser === c.user_id ? "ring-1 ring-accent" : ""}`}
                  onClick={() => setChatUser(c.user_id)}
                >
                  <p className="font-medium">{c.label}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{c.preview}</p>
                  <p className="mt-1 text-xs text-muted">
                    {c.count} messages · {new Date(c.updated_at).toLocaleString("en-AU")}
                  </p>
                </button>
              </li>
            ))}
          </ul>
          <section className="es-card space-y-3 p-5">
            {!chatUser ? (
              <p className="text-sm text-muted">AI expert chats stay on the customer app. Open one to read the transcript.</p>
            ) : (
              (chat.data ?? []).map((m, i) => (
                <div key={i} className={`rounded-lg px-4 py-3 text-sm ${m.role === "user" ? "bg-raised" : "bg-surface"}`}>
                  <p className="text-xs capitalize text-muted">{m.role}</p>
                  <p className="mt-1 whitespace-pre-wrap">{m.content}</p>
                  {m.role === "assistant" ? (
                    <button
                      type="button"
                      className="mt-2 text-xs text-muted hover:text-paper"
                      onClick={() =>
                        void recordMemory({
                          kind: "reply",
                          title: "Expert keep",
                          body: m.content.slice(0, 1500),
                          source: "staff",
                        }).then(() => toast.success("Kept as training"))
                      }
                    >
                      Keep as training
                    </button>
                  ) : null}
                </div>
              ))
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
