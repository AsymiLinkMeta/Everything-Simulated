import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Headset } from "lucide-react";

export const Route = createFileRoute("/staff/service")({
  component: StaffService,
});

type Ticket = {
  id: string;
  contact_email: string;
  contact_name: string | null;
  order_id: string | null;
  subject: string;
  body: string;
  status: string;
  staff_reply: string | null;
  created_at: string;
};

function StaffService() {
  const qc = useQueryClient();
  const [replyMap, setReplyMap] = useState<Record<string, string>>({});

  const tickets = useQuery({
    queryKey: ["staff-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);
      return (data ?? []) as Ticket[];
    },
  });

  async function reply(id: string) {
    const replyText = (replyMap[id] ?? "").trim();
    if (!replyText) {
      toast.error("Write a reply first.");
      return;
    }
    try {
      const { error } = await supabase
        .from("support_tickets")
        .update({
          staff_reply: replyText,
          status: "resolved",
          replied_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw new Error(error.message);
      toast.success("Reply sent");
      setReplyMap((prev) => ({ ...prev, [id]: "" }));
      await qc.invalidateQueries({ queryKey: ["staff-tickets"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send reply.");
    }
  }

  async function setStatus(id: string, status: string) {
    try {
      const { error } = await supabase
        .from("support_tickets")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw new Error(error.message);
      await qc.invalidateQueries({ queryKey: ["staff-tickets"] });
    } catch {
      toast.error("Could not update status");
    }
  }

  const open = tickets.data?.filter((t) => t.status === "open") ?? [];
  const pending = tickets.data?.filter((t) => t.status === "pending") ?? [];
  const resolved = tickets.data?.filter((t) => t.status === "resolved" || t.status === "closed") ?? [];

  return (
    <div className="space-y-6">
      <div>
        <p className="es-kicker">Customer Service</p>
        <h1 className="mt-2 text-3xl font-medium">Service Desk</h1>
      </div>

      {tickets.isPending ? (
        <div className="es-card p-5 text-sm text-muted">Loading…</div>
      ) : !tickets.data?.length ? (
        <div className="es-card p-6 text-center">
          <Headset className="mx-auto size-5 text-muted" />
          <p className="mt-2 text-sm text-muted">No support tickets yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {open.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-medium">Open ({open.length})</h2>
              <ul className="space-y-3">
                {open.map((t) => (
                  <TicketCard key={t.id} ticket={t} replyMap={replyMap} setReplyMap={setReplyMap} onReply={reply} onSetStatus={setStatus} />
                ))}
              </ul>
            </section>
          )}
          {pending.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-medium">Pending ({pending.length})</h2>
              <ul className="space-y-3">
                {pending.map((t) => (
                  <TicketCard key={t.id} ticket={t} replyMap={replyMap} setReplyMap={setReplyMap} onReply={reply} onSetStatus={setStatus} />
                ))}
              </ul>
            </section>
          )}
          {resolved.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-medium">Resolved ({resolved.length})</h2>
              <ul className="space-y-3">
                {resolved.map((t) => (
                  <TicketCard key={t.id} ticket={t} replyMap={replyMap} setReplyMap={setReplyMap} onReply={reply} onSetStatus={setStatus} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function TicketCard({
  ticket,
  replyMap,
  setReplyMap,
  onReply,
  onSetStatus,
}: {
  ticket: Ticket;
  replyMap: Record<string, string>;
  setReplyMap: (fn: (prev: Record<string, string>) => Record<string, string>) => void;
  onReply: (id: string) => void;
  onSetStatus: (id: string, status: string) => void;
}) {
  return (
    <li className="es-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{ticket.subject}</p>
          <p className="text-xs text-muted">
            {ticket.contact_name || ticket.contact_email}
            {ticket.order_id && ` · ${ticket.order_id}`}
            {" · "}
            {new Date(ticket.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
          </p>
        </div>
        <span className="text-xs capitalize text-muted">{ticket.status}</span>
      </div>
      <p className="mt-3 text-sm text-paper">{ticket.body}</p>
      {ticket.staff_reply && (
        <div className="mt-3 rounded-md bg-raised p-3 text-sm">
          <p className="text-xs text-muted">Staff reply</p>
          <p className="mt-1 text-paper">{ticket.staff_reply}</p>
        </div>
      )}
      {ticket.status !== "resolved" && ticket.status !== "closed" && (
        <div className="mt-4 space-y-2">
          <Input
            value={replyMap[ticket.id] ?? ""}
            onChange={(e) => setReplyMap((prev) => ({ ...prev, [ticket.id]: e.target.value }))}
            placeholder="Type a reply…"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => onReply(ticket.id)}>
              Send reply
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onSetStatus(ticket.id, "pending")}>
              Mark pending
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
