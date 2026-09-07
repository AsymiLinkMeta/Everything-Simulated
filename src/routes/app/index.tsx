import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getProfile, listMyBookings, listMyJobs, listMyQuotes } from "@/lib/es/server";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { aud } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/")({
  component: AppHome,
});

function AppHome() {
  const user = useCurrentUser();
  const quotes = useQuery({ queryKey: ["my-quotes"], queryFn: () => listMyQuotes() });
  const jobs = useQuery({ queryKey: ["my-jobs"], queryFn: () => listMyJobs() });
  const bookings = useQuery({ queryKey: ["my-bookings"], queryFn: () => listMyBookings() });
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => getProfile() });

  return (
    <div className="space-y-8">
      <div>
        <p className="es-kicker">Account</p>
        <h1 className="mt-2 text-3xl font-medium">
          {user?.displayName ? `Hello, ${user.displayName}` : "Your build"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          Quotes, workshop jobs and studio bookings in one place.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Link to="/app/build" className="es-card p-5">
          <p className="es-kicker">Configure</p>
          <p className="mt-2 font-medium">Open the builder</p>
        </Link>
        <Link to="/app/chat" className="es-card p-5">
          <p className="es-kicker">Expert</p>
          <p className="mt-2 font-medium">Ask the workshop</p>
        </Link>
        <Link to="/app/book" className="es-card p-5">
          <p className="es-kicker">Studio</p>
          <p className="mt-2 font-medium">Book a demo</p>
        </Link>
      </div>
      {profile.data?.isStaff ? (
        <Button asChild variant="outline">
          <Link to="/staff">Open staff portal</Link>
        </Button>
      ) : null}
      <section>
        <h2 className="text-lg font-medium">Quotes</h2>
        <ul className="mt-3 space-y-2">
          {quotes.data?.length ? (
            quotes.data.map((q) => (
              <li key={q.id} className="es-card flex items-center justify-between px-4 py-3 text-sm">
                <span>
                  {q.id} · {q.title}
                  <span className="ml-2 text-muted">{q.check_ok ? "clear" : "holds"}</span>
                </span>
                <span className="tabular-nums text-muted">{aud(q.total_ex_gst)}</span>
              </li>
            ))
          ) : (
            <li className="text-sm text-muted">No quotes yet. Load a package and save one.</li>
          )}
        </ul>
      </section>
      <section>
        <h2 className="text-lg font-medium">Jobs</h2>
        <ul className="mt-3 space-y-2">
          {jobs.data?.length ? (
            jobs.data.map((j) => (
              <li key={j.id} className="es-card px-4 py-3 text-sm">
                Job #{j.id} · <span className="capitalize">{j.stage}</span>
                {j.quote_id ? <span className="text-muted"> · {j.quote_id}</span> : null}
              </li>
            ))
          ) : (
            <li className="text-sm text-muted">No workshop jobs yet.</li>
          )}
        </ul>
      </section>
      <section>
        <h2 className="text-lg font-medium">Bookings</h2>
        <ul className="mt-3 space-y-2">
          {bookings.data?.length ? (
            bookings.data.map((b) => (
              <li key={b.id} className="es-card px-4 py-3 text-sm">
                {b.kind} · {b.slot ?? "unscheduled"} · {b.status}
              </li>
            ))
          ) : (
            <li className="text-sm text-muted">No studio bookings.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
