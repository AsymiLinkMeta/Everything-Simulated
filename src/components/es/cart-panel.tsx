import { Link } from "@tanstack/react-router";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/lib/toast";
import { fetchPrebuildLinks, fetchPublishedPrebuilds, livePackages } from "@/lib/es/prebuilds";
import { fetchProducts } from "@/lib/es/product-cache";
import { useCart } from "@/lib/es/cart-store";
import { saveQuote } from "@/lib/es/server";
import { useServerQuote } from "@/lib/es/pricing";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { aud } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckPills, IssueList, LineName } from "./bits";

export function CartPanel({ compact = false }: { compact?: boolean }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const { user } = useCurrentUserState();
  const catalog = useQuery({ queryKey: ["products"], queryFn: () => fetchProducts() });
  // Only names for the buttons; the full prebuild list (with images) loads on click.
  const packs = useQuery({ queryKey: ["prebuild-links"], queryFn: fetchPrebuildLinks });
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
  const prebuildSlug = useCart((s) => s.prebuildSlug);
  // Totals come from quote_cart() so the cart shows what checkout will charge.
  const quote = useServerQuote({ lines, postcode, prebuild: prebuildSlug, driverWeightKg }, { enabled: ready && lines.length > 0 });

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
        {lines.length ? <CheckPills result={result} /> : null}
      </div>
      {!compact ? (
        <div className="flex flex-wrap gap-2">
          {(packs.data?.length ? packs.data : livePackages()).map((p) => (
            <Button key={p.slug} variant="subtle" size="sm" onClick={async () => {
              if (!livePackages().some((x) => x.slug === p.slug)) await fetchPublishedPrebuilds().catch(() => {});
              loadPackage(p.slug);
            }}>
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
      {lines.length ? <IssueList issues={result.issues} /> : null}
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-muted">
          Postcode
          <Input
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={4}
            placeholder="e.g. 4215"
            value={postcode}
            onChange={(e) => setPostcode(e.target.value.replace(/\D/g, "").slice(0, 4))}
          />
        </label>
        <label className="text-xs text-muted">
          Driver weight (kg)
          <Input
            type="number"
            inputMode="numeric"
            min={40}
            max={160}
            placeholder="e.g. 80"
            value={driverWeightKg ?? ""}
            onChange={(e) => setWeight(e.target.value ? Number(e.target.value) : undefined)}
          />
        </label>
        <p className="col-span-2 text-[11px] leading-4 text-muted">
          Postcode prices the freight. Driver weight only matters for motion rigs (we assume 80 kg if blank).
        </p>
      </div>
      <div aria-live="polite" data-testid="cart-total">
        {!lines.length ? (
          <p className="text-sm text-muted">Add parts or load a prebuild to see a price.</p>
        ) : quote.isError ? (
          <p className="text-sm text-red-300">
            Couldn't price this cart.{" "}
            <button type="button" className="underline" onClick={() => quote.refetch()}>
              Try again
            </button>
          </p>
        ) : !quote.data ? (
          <div className="space-y-2" aria-label="Pricing your cart">
            <div className="h-6 w-40 animate-pulse rounded bg-raised" />
            <div className="h-4 w-56 animate-pulse rounded bg-raised" />
          </div>
        ) : (
          <>
            <p className="text-xl font-medium tabular-nums">{aud(quote.data.items_ex_gst)} + GST</p>
            <p className="text-sm text-muted">{aud(quote.data.total_inc_gst)} inc GST with freight</p>
            <p className="mt-1 text-xs text-muted">
              {postcode.length === 4
                ? <>Freight {aud(quote.data.freight_ex_gst)} — {quote.data.freight.label}</>
                : <>Freight estimate {aud(quote.data.freight_ex_gst)}. Add your postcode for the exact price.</>}
            </p>
            {quote.data.mode === "package" ? (
              <p className="mt-1 text-xs text-muted">Package price applied.</p>
            ) : null}
          </>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {lines.length ? (
          <Button asChild>
            <Link to="/checkout">Checkout</Link>
          </Button>
        ) : (
          <Button disabled aria-describedby="cart-empty-hint">
            Checkout
          </Button>
        )}
        {!lines.length ? (
          <p id="cart-empty-hint" className="sr-only">
            Add parts or load a prebuild to check out.
          </p>
        ) : null}
        <Button variant="outline" onClick={onSave} disabled={!lines.length}>
          {user ? "Save quote" : "Sign in to save quote"}
        </Button>
        <Button variant="ghost" asChild>
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
