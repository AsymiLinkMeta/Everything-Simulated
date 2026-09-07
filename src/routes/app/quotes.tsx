import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listMyQuotes } from "@/lib/es/server";
import { aud } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/quotes")({
  component: Quotes,
});

function Quotes() {
  const quotes = useQuery({ queryKey: ["my-quotes"], queryFn: () => listMyQuotes() });
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="es-kicker">Account</p>
          <h1 className="mt-2 text-3xl font-medium">Quotes</h1>
        </div>
        <Button asChild variant="outline">
          <Link to="/app/build">New build</Link>
        </Button>
      </div>
      <ul className="space-y-3">
        {quotes.data?.length ? (
          quotes.data.map((q) => (
            <li key={q.id} className="es-card p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{q.id}</p>
                <p className="tabular-nums">{aud(q.total_ex_gst)} + GST</p>
              </div>
              <p className="mt-1 text-sm text-muted">
                {q.title} · {q.status} · {q.check_ok ? "compatible" : "needs a fix"}
              </p>
            </li>
          ))
        ) : (
          <li className="text-sm text-muted">Nothing saved yet.</li>
        )}
      </ul>
    </div>
  );
}
