import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CartPanel } from "@/components/es/cart-panel";
import { ProductTile } from "@/components/es/bits";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { fetchProducts } from "@/lib/es/product-cache";
import { askBuilder } from "@/lib/es/server";
import { useCart } from "@/lib/es/cart-store";
import { Sparkles, Loader2 } from "lucide-react";

export const Route = createFileRoute("/app/build")({
  component: AppBuild,
});

function AppBuild() {
  const products = useQuery({ queryKey: ["products"], queryFn: () => fetchProducts() });
  const lines = useCart((s) => s.lines);
  const driverWeightKg = useCart((s) => s.driverWeightKg);
  const [aiReply, setAiReply] = useState<string | null>(null);
  const [aiPending, setAiPending] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  async function getRecommendation() {
    setAiPending(true);
    setAiError(null);
    setAiReply(null);
    try {
      const res = await askBuilder({
        message:
          "Review my current build. Recommend the best package or part swaps for a balanced rig at this price point, and flag anything the checker would block.",
        lines,
        driverWeightKg,
        task: "recommend",
      });
      setAiReply(res.reply);
    } catch {
      setAiError("The AI agent could not generate a recommendation right now. Try again shortly.");
    } finally {
      setAiPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="es-kicker">Builder</p>
        <h1 className="mt-2 text-3xl font-medium">Spec a crate</h1>
      </div>

      <div className="rounded-card border border-line bg-panel p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-muted" />
              <p className="es-kicker">AI assist</p>
            </div>
            <p className="mt-2 max-w-xl text-sm text-muted">
              Get a tailored recommendation based on your current cart. The agent only references real
              parts and compatibility rules.
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
        {aiReply ? (
          <div className="es-card mt-4 whitespace-pre-wrap p-4 text-sm">{aiReply}</div>
        ) : null}
        {aiError ? <p className="mt-4 text-sm text-red-400">{aiError}</p> : null}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="grid grid-cols-2 gap-4">
          {(products.data ?? []).map((item) => (
            <ProductTile key={item.sku} item={item} />
          ))}
        </div>
        <CartPanel />
      </div>
    </div>
  );
}
