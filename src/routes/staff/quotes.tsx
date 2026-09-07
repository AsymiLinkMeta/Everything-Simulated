import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { staffCreateJob, staffListQuotes } from "@/lib/es/server";
import { aud } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/staff/quotes")({
  component: StaffQuotes,
});

function StaffQuotes() {
  const qc = useQueryClient();
  const quotes = useQuery({ queryKey: ["staff-quotes"], queryFn: () => staffListQuotes() });

  async function convert(id: string) {
    try {
      await staffCreateJob({ data: { quoteId: id, notes: "From quote" } });
      toast.success("Job created");
      await qc.invalidateQueries({ queryKey: ["staff-jobs"] });
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
      <ul className="space-y-3">
        {quotes.data?.map((q) => (
          <li key={q.id} className="es-card flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <p className="font-medium">{q.id}</p>
              <p className="text-sm text-muted">
                {q.title} · {q.status} · {q.check_ok ? "clear" : "blocked"} · {aud(q.total_ex_gst)}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => convert(q.id)}>
              Convert to job
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
