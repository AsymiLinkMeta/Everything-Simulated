import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { staffListBookings, staffListJobs, staffListQuotes } from "@/lib/es/server";
import { aud } from "@/lib/utils";

export const Route = createFileRoute("/staff/")({
  component: Pipeline,
});

function Pipeline() {
  const quotes = useQuery({ queryKey: ["staff-quotes"], queryFn: () => staffListQuotes() });
  const jobs = useQuery({ queryKey: ["staff-jobs"], queryFn: () => staffListJobs() });
  const bookings = useQuery({ queryKey: ["staff-bookings"], queryFn: () => staffListBookings() });

  const cards = [
    { label: "Open quotes", value: quotes.data?.length ?? "—" },
    { label: "Jobs", value: jobs.data?.length ?? "—" },
    { label: "Bookings", value: bookings.data?.length ?? "—" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <p className="es-kicker">Workshop</p>
        <h1 className="mt-2 text-3xl font-medium">Pipeline</h1>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="es-card p-5">
            <p className="es-kicker">{c.label}</p>
            <p className="mt-2 text-3xl font-medium tabular-nums">{c.value}</p>
          </div>
        ))}
      </div>
      <section>
        <h2 className="text-lg font-medium">Latest quotes</h2>
        <ul className="mt-3 space-y-2">
          {quotes.data?.slice(0, 8).map((q) => (
            <li key={q.id} className="es-card flex justify-between px-4 py-3 text-sm">
              <span>
                {q.id} · {q.title}
              </span>
              <span className="tabular-nums text-muted">{aud(q.total_ex_gst)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
