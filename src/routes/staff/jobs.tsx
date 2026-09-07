import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { staffListJobs, staffSetJobStage } from "@/lib/es/server";
import { Button } from "@/components/ui/button";
import { Wrench } from "lucide-react";

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
      {jobs.isPending ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <section key={i} className="es-card p-4">
              <p className="text-sm text-muted">Loading…</p>
            </section>
          ))}
        </div>
      ) : !jobs.data?.length ? (
        <div className="es-card p-6 text-center">
          <Wrench className="mx-auto size-5 text-muted" />
          <p className="mt-2 text-sm text-muted">No jobs in the pipeline yet.</p>
          <p className="mt-1 text-xs text-muted">Convert a quote to create one.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {STAGES.map((stage) => {
            const stageJobs = jobs.data?.filter((j) => j.stage === stage) ?? [];
            return (
              <section key={stage} className="es-card p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-medium capitalize">{stage}</h2>
                  <span className="text-xs text-muted tabular-nums">{stageJobs.length}</span>
                </div>
                <ul className="mt-3 space-y-2">
                  {stageJobs.length === 0 ? (
                    <li className="rounded-md bg-raised p-3 text-sm text-muted">No jobs</li>
                  ) : (
                    stageJobs.map((j) => (
                      <li key={j.id} className="rounded-md bg-raised p-3 text-sm">
                        <p className="font-medium">#{j.id}</p>
                        <p className="text-xs text-muted">{j.quote_id ?? "no quote"}</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {STAGES.filter((s) => s !== stage).map((s) => (
                            <Button key={s} size="sm" variant="ghost" onClick={() => setStage(j.id, s)}>
                              {s}
                            </Button>
                          ))}
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
