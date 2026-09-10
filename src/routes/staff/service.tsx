import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LifeBuoy } from "lucide-react";
import { replyToTicket, staffListTickets, staffSetTicketStatus, type TicketStatus } from "@/lib/es/tickets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/staff/service")({
  component: StaffService,
});

function StaffService() {
  const qc = useQueryClient();
  const tickets = useQuery({ queryKey: ["staff-tickets"], queryFn: staffListTickets });
  const [reply, setReply] = useState<Record<string, string>>({});

  async function setStatus(id: string, status: TicketStatus) {
    try {
      await staffSetTicketStatus(id, status);
      await qc.invalidateQueries({ queryKey: ["staff-tickets"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update ticket");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="es-kicker">Support</p>
        <h1 className="mt-2 text-3xl font-medium">Service desk</h1>
      </div>
      {!tickets.data?.length && !tickets.isPending ? (
        <div className="es-card p-6 text-center">
          <LifeBuoy className="mx-auto size-5 text-muted" />
          <p className="mt-2 text-sm text-muted">No customer tickets yet.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {tickets.data?.map((t) => (
            <li key={t.id} className="es-card space-y-3 p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{t.subject}</p>
                  <p className="text-xs text-muted">
                    {t.id}
                    {t.order_id ? ` · ${t.order_id}` : ""} · {t.status}
                  </p>
                </div>
                <div className="flex gap-2">
                  {(["open", "waiting", "closed"] as TicketStatus[]).map((s) => (
                    <Button key={s} size="sm" variant={t.status === s ? "primary" : "outline"} onClick={() => setStatus(t.id, s)}>
                      {s}
                    </Button>
                  ))}
                </div>
              </div>
              <p className="whitespace-pre-line text-sm text-muted">{t.body}</p>
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
                    await qc.invalidateQueries({ queryKey: ["staff-tickets"] });
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Could not reply");
                  }
                }}
              >
                <Input
                  value={reply[t.id] ?? ""}
                  onChange={(e) => setReply((r) => ({ ...r, [t.id]: e.target.value }))}
                  placeholder="Reply to customer"
                />
                <Button type="submit" size="sm">
                  Send
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
