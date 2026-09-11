import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { staffListQuotes } from "@/lib/es/server";
import { staffConvertQuote } from "@/lib/es/crm-oms";
import { recordMemory } from "@/lib/es/agent";
import { StaffAsk } from "@/components/es/staff-ask";
import { aud } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";

export const Route = createFileRoute("/staff/quotes")({
  component: StaffQuotes,
});

function StaffQuotes() {
  const qc = useQueryClient();
  const [converting, setConverting] = useState<string | null>(null);
  const quotes = useQuery({ queryKey: ["staff-quotes"], queryFn: () => staffListQuotes() });

  async function convert(id: string) {
    setConverting(id);
    try {
      const result = await staffConvertQuote(id);
      toast.success(`Order ${result.orderId} created`);
      await qc.invalidateQueries({ queryKey: ["staff-jobs"] });
      await qc.invalidateQueries({ queryKey: ["staff-quotes"] });
      await qc.invalidateQueries({ queryKey: ["oms-orders"] });
      await qc.invalidateQueries({ queryKey: ["pipeline-alerts"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not convert quote");
    } finally {
      setConverting(null);
    }
  }

  async function keepBom(q: { id: string; title: string; lines: { sku: string; qty: number }[] }) {
    try {
      await recordMemory({
        kind: "won_bom",
        title: `Quote ${q.id}`,
        body: q.lines.map((l) => `${l.qty}× ${l.sku}`).join(", ") || q.title,
        payload: { quoteId: q.id, lines: q.lines },
        source: "staff",
      });
      toast.success("Kept as training");
      await qc.invalidateQueries({ queryKey: ["agent-memory"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="es-kicker">Sales</p>
        <h1 className="mt-2 text-3xl font-medium">Quotes</h1>
      </div>
      <StaffAsk tool="quote" title="Write a quote" placeholder="Junior haptic under $12k, 12Nm, Gold Coast demo…" />
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
              <div className="flex flex-wrap gap-2">
                {!q.check_ok ? (
                  <Button size="sm" variant="outline" asChild>
                    <Link to={`/staff/agent?tool=fix&quote=${q.id}`}>Fix with agent</Link>
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => void keepBom(q)}>
                    Keep BOM
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={converting === q.id || q.status === "won" || q.status === "converted"}
                  onClick={() => convert(q.id)}
                >
                  {converting === q.id ? "Converting…" : q.status === "won" || q.status === "converted" ? "Converted" : "Convert to order"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}