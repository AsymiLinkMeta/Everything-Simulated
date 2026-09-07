import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { staffCreateJob, staffListQuotes } from "@/lib/es/server";
import { aud } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";

export const Route = createFileRoute("/staff/quotes")({
  component: StaffQuotes,
});

function StaffQuotes() {
  const qc = useQueryClient();
  const quotes = useQuery({ queryKey: ["staff-quotes"], queryFn: () => staffListQuotes() });

  async function convert(id: string) {
    try {
      await staffCreateJob({ quoteId: id, notes: "From quote" });
      toast.success("Job created");
      await qc.invalidateQueries({ queryKey: ["staff-jobs"] });
      await qc.invalidateQueries({ queryKey: ["staff-quotes"] });
    } catch {
      toast.error("Could not create job");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="es-kicker">Sales</p>
        <h1 className="mt-2 text-3xl font-medium">Quotes</h1>
      </div>
      {quotes.isPending ? (
        <ul className="space-y-3">
          {[1, 2, 3].map((i) => (
            <li key={i} className="es-card p-5">
              <p className="text-muted">Loading…</p>
            </li>
          ))}
        </ul>
      ) : !quotes.data?.length ? (
        <div className="es-card p-6 text-center">
          <FileText className="mx-auto size-5 text-muted" />
          <p className="mt-2 text-sm text-muted">No quotes submitted yet.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {quotes.data.map((q) => (
            <li key={q.id} className="es-card flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <p className="font-medium">{q.id}</p>
                <p className="text-sm text-muted">
                  {q.title} · <span className="capitalize">{q.status}</span> · {q.check_ok ? "clear" : "blocked"} · {aud(q.total_ex_gst)}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => convert(q.id)}>
                Convert to job
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
