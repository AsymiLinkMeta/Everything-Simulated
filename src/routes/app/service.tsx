import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LifeBuoy } from "lucide-react";
import { supabase } from "@/lib/db";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { pageHead } from "@/lib/es/seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/app/service")({
  head: () =>
    pageHead({
      title: "Service Desk | Everything Simulated",
      description: "Get help with your build, order, or simulator.",
      path: "/app/service",
    }),
  component: ServiceDesk,
});

type Ticket = {
  id: string;
  subject: string;
  status: string;
  staff_reply: string | null;
  created_at: string;
};

function ServiceDesk() {
  const user = useCurrentUser();
  const qc = useQueryClient();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [orderId, setOrderId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const tickets = useQuery({
    queryKey: ["my-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("id, subject, status, staff_reply, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw new Error(error.message);
      return (data ?? []) as Ticket[];
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) {
      toast.error("Subject and message are required.");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("support_tickets").insert({
        contact_email: user?.email ?? "",
        contact_name: user?.displayName ?? "",
        subject: subject.trim(),
        body: body.trim(),
        order_id: orderId.trim() || null,
      });
      if (error) throw new Error(error.message);
      toast.success("Ticket submitted. We'll reply by email.");
      setSubject("");
      setBody("");
      setOrderId("");
      await qc.invalidateQueries({ queryKey: ["my-tickets"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit ticket.");
    } finally {
      setSubmitting(false);
    }
  }

  const toneFor = (s: string) =>
    s === "resolved" || s === "closed" ? "text-emerald-400" : s === "pending" ? "text-amber-400" : "text-paper";

  return (
    <div className="space-y-8">
      <div>
        <p className="es-kicker">Support</p>
        <h1 className="mt-2 text-3xl font-medium">Service Desk</h1>
        <p className="mt-2 text-sm text-muted">
          Questions about your build, delivery, or simulator? Send us a message and we'll get back to you.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="es-card space-y-4 p-5">
          <h2 className="font-medium">New ticket</h2>
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
              {submitting ? "Submitting…" : "Submit ticket"}
            </Button>
          </form>
        </div>

        <div className="space-y-4">
          <h2 className="font-medium">Your tickets</h2>
          {tickets.isPending ? (
            <div className="es-card p-5 text-sm text-muted">Loading…</div>
          ) : !tickets.data?.length ? (
            <div className="es-card p-6 text-center">
              <LifeBuoy className="mx-auto size-5 text-muted" />
              <p className="mt-2 text-sm text-muted">No tickets yet.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {tickets.data.map((t) => (
                <li key={t.id} className="es-card p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{t.subject}</p>
                    <span className={`text-xs capitalize ${toneFor(t.status)}`}>{t.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {new Date(t.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                  </p>
                  {t.staff_reply && (
                    <div className="mt-3 rounded-md bg-raised p-3 text-sm">
                      <p className="text-xs text-muted">Staff reply</p>
                      <p className="mt-1 text-paper">{t.staff_reply}</p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          <Link to="/app/orders" className="block text-sm text-muted hover:text-paper">
            View your orders →
          </Link>
        </div>
      </div>
    </div>
  );
}
