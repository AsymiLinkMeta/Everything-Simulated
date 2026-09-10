import { Link } from "@tanstack/react-router";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchPublishedPrebuilds, livePackages } from "@/lib/es/prebuilds";
import { fetchProducts } from "@/lib/es/product-cache";
import { useCart } from "@/lib/es/cart-store";
import { saveQuote } from "@/lib/es/server";
import { freightLabel } from "@/lib/es/freight";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { aud, gstInclusive } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckPills, IssueList, LineName } from "./bits";

export function CartPanel({ compact = false }: { compact?: boolean }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const { user } = useCurrentUserState();
  const catalog = useQuery({ queryKey: ["products"], queryFn: () => fetchProducts() });
  const packs = useQuery({ queryKey: ["prebuilds"], queryFn: fetchPublishedPrebuilds });
  const lines = useCart((s) => s.lines);
  const driverWeightKg = useCart((s) => s.driverWeightKg);
  const postcode = useCart((s) => s.postcode);
  const setQty = useCart((s) => s.setQty);
  const add = useCart((s) => s.add);
  const remove = useCart((s) => s.remove);
  const loadPackage = useCart((s) => s.loadPackage);
  const setWeight = useCart((s) => s.setWeight);
  const setPostcode = useCart((s) => s.setPostcode);
  const clear = useCart((s) => s.clear);
  const result = useCart((s) => s.result)();

  async function onSave() {
    if (!user) {
      toast.message("Sign In to save this quote to your account.");
      return;
    }
    try {
      const saved = await saveQuote({ lines, postcode, title: "Custom build", driverWeightKg });
      toast.success(`Quote ${saved.id} saved`);
    } catch {
      toast.error("Could not save quote. Sign In and try again.");
    }
  }

  if (!ready) {
    return <aside className="es-card h-64 animate-pulse p-5" />;
  }

  return (
    <aside className="es-card space-y-5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="es-kicker">Build</p>
          <h2 className="text-lg font-medium">Your cart</h2>
        </div>
        <CheckPills result={result} />
      </div>
      {!compact ? (
        <div className="flex flex-wrap gap-2">
          {(packs.data ?? livePackages()).map((p) => (
            <Button key={p.slug} variant="outline" size="sm" onClick={() => loadPackage(p.slug)}>
              Load {p.name}
            </Button>
          ))}
        </div>
      ) : null}
      <ul className="space-y-3">
        {lines.length === 0 ? (
          <li className="text-sm text-muted">Cart is empty. Load a package or add parts from the shop.</li>
        ) : (
          lines.map((line) => {
            const item = catalog.data?.find((p) => p.sku === line.sku);
            return (
              <li key={line.sku} className="flex items-center gap-3 border-b border-line pb-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    <LineName sku={line.sku} />
                  </p>
                  <p className="text-xs text-muted">{item ? aud(item.sellExGst) : line.sku}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="grid size-11 place-items-center rounded-md border border-line"
                    onClick={() => setQty(line.sku, line.qty - 1)}
                    aria-label="Decrease"
                  >
                    <Minus className="size-3" />
                  </button>
                  <span className="w-6 text-center text-sm tabular-nums">{line.qty}</span>
                  <button
                    type="button"
                    className="grid size-11 place-items-center rounded-md border border-line"
                    onClick={() => setQty(line.sku, line.qty + 1)}
                    aria-label="Increase"
                  >
                    <Plus className="size-3" />
                  </button>
                  <button
                    type="button"
                    className="grid size-11 place-items-center rounded-md text-muted"
                    onClick={() => remove(line.sku)}
                    aria-label="Remove"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              </li>
            );
          })
        )}
      </ul>
      {result.issues
        .filter((i) => i.adapterSku && !lines.some((l) => l.sku === i.adapterSku))
        .map((i) => (
          <Button key={i.code} variant="outline" size="sm" onClick={() => i.adapterSku && add(i.adapterSku)}>
            Add required adapter
          </Button>
        ))}
      <IssueList issues={result.issues} />
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-muted">
          Driver kg
          <Input
            type="number"
            min={40}
            max={160}
            value={driverWeightKg}
            onChange={(e) => setWeight(Number(e.target.value) || 80)}
          />
        </label>
        <label className="text-xs text-muted">
          Postcode
          <Input value={postcode} onChange={(e) => setPostcode(e.target.value)} />
        </label>
      </div>
      <div>
        <p className="text-xl font-medium tabular-nums">{aud(result.totalExGst)} + GST</p>
        <p className="text-sm text-muted">{aud(gstInclusive(result.totalExGst + result.freightExGst))} inc GST with freight</p>
        <p className="mt-1 text-xs text-muted">
          Crate {aud(result.freightExGst)} — {freightLabel(postcode, lines)}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Button asChild>
          <Link to="/checkout">Checkout</Link>
        </Button>
        <Button variant="outline" onClick={onSave}>
          {user ? "Save quote" : "Sign In to save quote"}
        </Button>
        <Button variant="outline" asChild>
          <Link to="/app/chat">Ask the build expert</Link>
        </Button>
        {lines.length ? (
          <button type="button" className="text-xs text-muted underline-offset-4 hover:underline" onClick={() => clear()}>
            Start over
          </button>
        ) : null}
      </div>
    </aside>
  );
}
