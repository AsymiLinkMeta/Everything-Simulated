import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { staffListBookings, staffListJobs, staffListQuotes } from "@/lib/es/server";
import { aud } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import { Boxes, Calendar, FileText, Wrench } from "lucide-react";

export const Route = createFileRoute("/staff/")({
  component: Pipeline,
});

function Pipeline() {
  const quotes = useQuery({ queryKey: ["staff-quotes"], queryFn: () => staffListQuotes() });
  const jobs = useQuery({ queryKey: ["staff-jobs"], queryFn: () => staffListJobs() });
  const bookings = useQuery({ queryKey: ["staff-bookings"], queryFn: () => staffListBookings() });

  const openQuotes = quotes.data?.filter((q) => q.status !== "converted" && q.status !== "archived") ?? [];
  const activeJobs = jobs.data?.filter((j) => j.stage !== "delivered") ?? [];
  const pendingBookings = bookings.data?.filter((b) => b.status === "requested") ?? [];

  const cards = [
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

  return (
    <div className="space-y-8">
      <div>
        <p className="es-kicker">Workshop</p>
        <h1 className="mt-2 text-3xl font-medium">Pipeline</h1>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
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
