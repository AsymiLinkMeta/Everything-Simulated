import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { staffListJobs, staffSetJobStage } from "@/lib/es/server";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/staff/jobs")({
  component: Jobs,
});

const STAGES = ["enquiry", "deposit", "build", "qa", "crate", "delivered"];

function Jobs() {
  const qc = useQueryClient();
  const jobs = useQuery({ queryKey: ["staff-jobs"], queryFn: () => staffListJobs() });

  async function setStage(id: number, stage: string) {
    try {
      await staffSetJobStage({ id, stage });
      await qc.invalidateQueries({ queryKey: ["staff-jobs"] });
    } catch {
      toast.error("Could not update stage");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="es-kicker">Workshop</p>
        <h1 className="mt-2 text-3xl font-medium">Jobs</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {STAGES.map((stage) => (
          <section key={stage} className="es-card p-4">
            <h2 className="text-sm font-medium capitalize">{stage}</h2>
            <ul className="mt-3 space-y-2">
              {jobs.data
                ?.filter((j) => j.stage === stage)
                .map((j) => (
                  <li key={j.id} className="rounded-md bg-raised p-3 text-sm">
                    <p>#{j.id}</p>
                    <p className="text-xs text-muted">{j.quote_id ?? "no quote"}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {STAGES.filter((s) => s !== stage).map((s) => (
                        <Button key={s} size="sm" variant="ghost" onClick={() => setStage(j.id, s)}>
                          {s}
                        </Button>
                      ))}
                    </div>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
