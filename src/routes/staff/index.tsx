import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { staffListBookings, staffListJobs, staffListQuotes } from "@/lib/es/server";
import { staffListContacts, staffListOrders } from "@/lib/es/crm-oms";
import { supabase } from "@/lib/db";
import { aud } from "@/lib/utils";
import { Bell, Boxes, Calendar, FileText, Handshake, Truck, Wrench } from "lucide-react";

export const Route = createFileRoute("/staff/")({
  component: Pipeline,
});

function Pipeline() {
  const qc = useQueryClient();
  const quotes = useQuery({ queryKey: ["staff-quotes"], queryFn: () => staffListQuotes() });
  const jobs = useQuery({ queryKey: ["staff-jobs"], queryFn: () => staffListJobs() });
  const bookings = useQuery({ queryKey: ["staff-bookings"], queryFn: () => staffListBookings() });
  const contacts = useQuery({ queryKey: ["crm-contacts"], queryFn: () => staffListContacts() });
  const orders = useQuery({ queryKey: ["oms-orders"], queryFn: () => staffListOrders() });

  const alerts = useQuery({
    queryKey: ["pipeline-alerts"],
    queryFn: async () => {
      const pipe = await supabase
        .from("pipeline_alerts")
        .select("id, order_id, kind, message, acknowledged, created_at")
        .eq("acknowledged", false)
        .order("created_at", { ascending: false })
        .limit(10);
      if (!pipe.error && (pipe.data?.length ?? 0) > 0) return pipe.data ?? [];
      const staff = await supabase
        .from("staff_alerts")
        .select("id, kind, title, body, href, read_at, created_at")
        .is("read_at", null)
        .order("created_at", { ascending: false })
        .limit(10);
      return (staff.data ?? []).map((row) => ({
        id: row.id,
        order_id: row.href?.split("/").pop() ?? null,
        kind: row.kind,
        message: row.body || row.title,
        acknowledged: Boolean(row.read_at),
        created_at: row.created_at,
      }));
    },
    refetchInterval: 15000,
  });

  async function dismissAlert(id: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase
        .from("pipeline_alerts")
        .update({ acknowledged: true, acknowledged_by: user?.id ?? null, acknowledged_at: new Date().toISOString() })
        .eq("id", id);
      await supabase.from("staff_alerts").update({ read_at: new Date().toISOString() }).eq("id", id);
      await qc.invalidateQueries({ queryKey: ["pipeline-alerts"] });
    } catch {
      // silent
    }
  }

  const openQuotes = quotes.data?.filter((q) => q.status !== "converted" && q.status !== "archived" && q.status !== "won") ?? [];
  const activeJobs = jobs.data?.filter((j) => j.stage !== "delivered") ?? [];
  const pendingBookings = bookings.data?.filter((b) => b.status === "requested") ?? [];

  const cards = [
    {
      label: "CRM pipeline",
      value: contacts.isPending ? "—" : contacts.data?.length ?? 0,
      icon: Handshake,
      to: "/staff/crm",
      hint: `${contacts.data?.filter((c) => c.crm_stage === "lead").length ?? 0} leads`,
    },
    {
      label: "Open orders",
      value: orders.isPending ? "—" : orders.data?.filter((o) => !["delivered", "cancelled"].includes(o.status)).length ?? 0,
      icon: Truck,
      to: "/staff/oms",
      hint: "OMS fulfillment",
    },
    {
      label: "Open quotes",
      value: quotes.isPending ? "—" : openQuotes.length,
      icon: FileText,
      to: "/staff/quotes",
      hint: pendingBookings.length > 0 ? `${pendingBookings.length} pending bookings` : "All caught up",
    },
    {
      label: "Active jobs",
      value: jobs.isPending ? "—" : activeJobs.length,
      icon: Wrench,
      to: "/staff/jobs",
      hint: "In workshop pipeline",
    },
    {
      label: "Bookings",
      value: bookings.isPending ? "—" : bookings.data?.length ?? 0,
      icon: Calendar,
      to: "/staff/bookings",
      hint: pendingBookings.length > 0 ? `${pendingBookings.length} need scheduling` : "None pending",
    },
  ];

  const activeAlerts = alerts.data ?? [];

  return (
    <div className="space-y-8">
      <div>
        <p className="es-kicker">Workshop</p>
        <h1 className="mt-2 text-3xl font-medium">Pipeline</h1>
      </div>

      {activeAlerts.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <Bell className="size-4 text-amber-400" />
            <h2 className="text-sm font-medium">New order alerts</h2>
          </div>
          <ul className="space-y-2">
            {activeAlerts.map((a) => (
              <li key={a.id} className="es-card flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{a.message}</p>
                  <p className="text-xs text-muted">
                    {new Date(a.created_at).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => dismissAlert(a.id)}
                  className="shrink-0 text-xs text-muted transition-colors hover:text-paper"
                >
                  Dismiss
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className="es-card p-5 group">
            <div className="flex items-center justify-between">
              <p className="es-kicker">{c.label}</p>
              <c.icon className="size-4 text-muted transition-colors group-hover:text-esred" />
            </div>
            <p className="mt-2 text-3xl font-medium tabular-nums">{c.value}</p>
            <p className="mt-1 text-xs text-muted">{c.hint}</p>
          </Link>
        ))}
      </div>
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Latest quotes</h2>
          <Link to="/staff/quotes" className="text-sm text-muted hover:text-esred transition-colors">
            View all
          </Link>
        </div>
        {quotes.isPending ? (
          <ul className="mt-3 space-y-2">
            {[1, 2, 3].map((i) => (
              <li key={i} className="es-card flex justify-between px-4 py-3 text-sm">
                <span className="text-muted">Loading…</span>
                <span className="tabular-nums text-muted">—</span>
              </li>
            ))}
          </ul>
        ) : openQuotes.length === 0 ? (
          <div className="mt-3 es-card p-6 text-center">
            <FileText className="mx-auto size-5 text-muted" />
            <p className="mt-2 text-sm text-muted">No open quotes yet.</p>
            <Link to="/staff/catalog" className="mt-3 inline-flex items-center gap-2 text-sm text-esred hover:underline">
              <Boxes className="size-4" />
              Manage catalogue
            </Link>
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {openQuotes.slice(0, 8).map((q) => (
              <li key={q.id} className="es-card flex justify-between px-4 py-3 text-sm">
                <span>
                  {q.id} · {q.title}
                </span>
                <span className="tabular-nums text-muted">{aud(q.total_ex_gst)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
