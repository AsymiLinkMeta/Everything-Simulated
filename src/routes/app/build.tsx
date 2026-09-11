import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { CartPanel } from "@/components/es/cart-panel";
import { BuildStudio } from "@/components/es/build-studio";
import { Button } from "@/components/ui/button";
import { askBuilder } from "@/lib/es/server";
import { useCart } from "@/lib/es/cart-store";
import { CheckPills } from "@/components/es/bits";
import { Sparkles, Loader2 } from "lucide-react";
import type { CartLine, CheckResult } from "@/lib/es/types";

export const Route = createFileRoute("/app/build")({
  component: AppBuild,
});

function AppBuild() {
  const lines = useCart((s) => s.lines);
  const setLines = useCart((s) => s.setLines);
  const driverWeightKg = useCart((s) => s.driverWeightKg);
  const [aiReply, setAiReply] = useState<string | null>(null);
  const [aiPending, setAiPending] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [proposed, setProposed] = useState<{ lines: CartLine[]; check: CheckResult | null } | null>(null);

  async function getRecommendation() {
    setAiPending(true);
    setAiError(null);
    setAiReply(null);
    setProposed(null);
    try {
      const res = await askBuilder({
        message:
          "Review my current build. Recommend the best package or part swaps for a balanced rig at this price point, and flag anything the checker would block.",
        lines,
        driverWeightKg,
        task: "recommend",
      });
      setAiReply(res.reply);
      if (res.proposedLines?.length) {
        setProposed({ lines: res.proposedLines, check: res.proposedCheck ?? null });
      }
    } catch {
      setAiError("The AI agent could not generate a recommendation right now. Try again shortly.");
    } finally {
      setAiPending(false);
    }
  }

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <p className="es-kicker">Builder</p>
        <h1 className="mt-2 text-3xl font-medium">Spec a crate</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Walk the same steps the workshop uses. Saved to this browser, and to your account when you quote.
        </p>
      </div>

      <div className="rounded-card border border-line bg-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-muted" />
              <p className="es-kicker">AI assist</p>
            </div>
            <p className="mt-2 max-w-xl text-sm text-muted">
              A second opinion on the live spec. It only names real SKUs and cannot clear a checker block.
            </p>
          </div>
          <Button variant="outline" size="sm" disabled={aiPending} onClick={getRecommendation}>
            {aiPending ? "Reviewing…" : "Recommend upgrades"}
          </Button>
        </div>
        {aiPending ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted">
            <Loader2 className="size-4 animate-spin" />
            Analysing your build…
          </div>
        ) : null}
        {aiReply ? <div className="es-card mt-4 whitespace-pre-wrap p-4 text-sm">{aiReply}</div> : null}
        {proposed ? (
          <div className="mt-3 space-y-3">
            <ul className="text-sm text-muted">
              {proposed.lines.map((l) => (
                <li key={l.sku}>
                  {l.qty} × {l.sku}
                </li>
              ))}
            </ul>
            {proposed.check ? <CheckPills result={proposed.check} /> : null}
            <Button
              size="sm"
              onClick={() => {
                setLines(proposed.lines);
                toast.success(proposed.check?.ok ? "Loaded into your build" : "Loaded — checker still has a hold");
              }}
            >
              Apply to cart
            </Button>
          </div>
        ) : null}
        {aiError ? <p className="mt-4 text-sm text-red-400">{aiError}</p> : null}
      </div>

      <div className="grid min-w-0 gap-8 lg:grid-cols-[1fr_340px]">
        <BuildStudio />
        <CartPanel />
      </div>
    </div>
  );
}