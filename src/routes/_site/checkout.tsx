import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/lib/es/cart-store";
import { fetchProducts } from "@/lib/es/product-cache";
import { placeGuestOrder, placeOrder } from "@/lib/es/server";
import { quoteFreight } from "@/lib/es/freight";
import { fetchBillingConfig, notifyOrder, startDepositCheckout } from "@/lib/es/billing";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { aud, gstInclusive } from "@/lib/utils";
import { pageHead } from "@/lib/es/seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckPills, LineName } from "@/components/es/bits";

export const Route = createFileRoute("/_site/checkout")({
  head: () =>
    pageHead({
      title: "Checkout | Everything Simulated",
      description: "Review your sim racing build and place your order.",
      path: "/checkout",
    }),
  component: Checkout,
});

function Checkout() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const { user } = useCurrentUserState();
  const catalog = useQuery({ queryKey: ["products"], queryFn: () => fetchProducts() });
  const billing = useQuery({ queryKey: ["billing-config"], queryFn: fetchBillingConfig });
  const lines = useCart((s) => s.lines);
  const driverWeightKg = useCart((s) => s.driverWeightKg);
  const postcode = useCart((s) => s.postcode);
  const quoteId = useCart((s) => s.quoteId);
  const setPostcode = useCart((s) => s.setPostcode);
  const clear = useCart((s) => s.clear);
  const result = useCart((s) => s.result)();
  const freight = quoteFreight({ postcode, lines });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [placing, setPlacing] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [payNow, setPayNow] = useState(true);

  useEffect(() => {
    if (user?.email) setEmail(user.email);
    if (user?.displayName) setName(user.displayName);
  }, [user]);

  const stripeOn = Boolean(billing.data?.stripe);
  const depositPercent = billing.data?.depositPercent ?? 30;
  const totalInc = gstInclusive(result.totalExGst + result.freightExGst);
  const depositInc = Math.max(50000, Math.round((totalInc * depositPercent) / 100));

  if (!ready) {
    return <div className="mx-auto max-w-3xl animate-pulse py-20" />;
  }

  if (orderId) {
    return (
      <div className="mx-auto max-w-lg px-5 py-20 text-center">
        <div className="mx-auto mb-6 grid size-16 place-items-center rounded-full bg-emerald-500/10">
          <Check className="size-8 text-emerald-400" />
        </div>
        <h1 className="text-2xl font-medium">Build request received</h1>
        <p className="mt-2 text-muted">
          Reference <span className="font-mono text-paper">{orderId}</span>. Keep this ID and the email you used.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link to={`/order?id=${encodeURIComponent(orderId)}${email.trim() ? `&email=${encodeURIComponent(email.trim())}` : ""}`}>Track this order</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/shop">Continue browsing</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-5 py-20 text-center">
        <ShoppingCart className="mx-auto mb-4 size-12 text-muted" />
        <h1 className="text-xl font-medium">Your cart is empty</h1>
        <p className="mt-2 text-sm text-muted">
          Add parts from the shop or load a pre-configured package to get started.
        </p>
        <Button className="mt-6" asChild>
          <Link to="/shop">Browse the shop</Link>
        </Button>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!result.ok) {
      toast.error("Please fix the compatibility issues in your build before checking out.");
      return;
    }
    const mail = email.trim();
    const fullName = name.trim();
    if (!fullName || !mail) {
      toast.error("Name and email are required.");
      return;
    }
    setPlacing(true);
    try {
      let id: string;
      if (user) {
        const res = await placeOrder({ lines, postcode, driverWeightKg, notes, name: fullName, phone, address, quoteId: quoteId ?? undefined });
        id = res.id;
      } else {
        const res = await placeGuestOrder({ lines, postcode, driverWeightKg, name: fullName, email: mail, phone, notes, address });
        id = res.id;
      }
      void notifyOrder({ orderId: id, kind: "placed", email: mail });
      try {
        sessionStorage.setItem("es-track-email", mail);
      } catch {
        /* private mode */
      }
      if (stripeOn && payNow) {
        const session = await startDepositCheckout({
          orderId: id,
          email: mail,
          origin: window.location.origin,
        });
        clear();
        window.location.href = session.url;
        return;
      }
      setOrderId(id);
      clear();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong placing your order.");
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <Link to="/shop" className="mb-6 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-paper">
        <ArrowLeft className="size-3.5" />
        Back to shop
      </Link>

      <h1 className="text-2xl font-medium">Checkout</h1>
      <p className="mt-1 text-sm text-muted">
        {stripeOn
          ? `Pay a ${depositPercent}% deposit on the next screen, or request the crate and we will invoice you.`
          : "Submit the build. The workshop will send a deposit invoice."}
      </p>

      <form onSubmit={handleSubmit} className="mt-8 grid gap-8 lg:grid-cols-5">
        <section className="order-first lg:order-last lg:col-span-2">
          <div className="es-card space-y-4 p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-medium">Order summary</h2>
              <CheckPills result={result} />
            </div>

            <ul className="space-y-2 border-t border-line pt-3">
              {lines.map((line) => {
                const item = catalog.data?.find((p) => p.sku === line.sku);
                return (
                  <li key={line.sku} className="flex justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">
                      <LineName sku={line.sku} />
                      {line.qty > 1 && <span className="ml-1 text-muted">x{line.qty}</span>}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted">
                      {item ? aud(item.sellExGst * line.qty) : "—"}
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="space-y-1 border-t border-line pt-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted">Subtotal (ex GST)</span>
                <span className="tabular-nums">{aud(result.totalExGst)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">Freight — {freight.zone}</span>
                <span className="tabular-nums">{aud(result.freightExGst)}</span>
              </div>
              <ul className="space-y-0.5 text-xs text-muted">
                {freight.breakdown.map((row) => (
                  <li key={row.label} className="flex justify-between gap-3">
                    <span>{row.label}</span>
                    <span className="tabular-nums">{aud(row.cents)}</span>
                  </li>
                ))}
                <li>
                  {freight.kg} kg · {freight.crates} crate{freight.crates === 1 ? "" : "s"} from 4215
                </li>
              </ul>
              <div className="flex justify-between pt-2 text-lg font-medium">
                <span>Total inc GST</span>
                <span className="tabular-nums">{aud(totalInc)}</span>
              </div>
              {stripeOn ? (
                <p className="text-xs text-muted">
                  Deposit due today {aud(depositInc)} inc GST ({depositPercent}%, minimum $500).
                </p>
              ) : null}
              {result.leadWeeks[1] > 0 && (
                <p className="text-xs text-muted">
                  Estimated lead time {result.leadWeeks[0]}–{result.leadWeeks[1]} weeks
                </p>
              )}
            </div>

            <Button variant="outline" size="sm" asChild className="w-full">
              <Link to="/shop">Edit cart</Link>
            </Button>
          </div>
        </section>

        <section className="lg:col-span-3 space-y-6">
          <div className="es-card space-y-4 p-5">
            <h2 className="font-medium">Your details</h2>
            {!user && (
              <p className="text-xs text-muted">
                Already have an account?{" "}
                <Link to="/login?next=/checkout" className="underline hover:text-paper">
                  Sign in
                </Link>{" "}
                for a faster checkout.
              </p>
            )}

            <label className="block">
              <span className="text-sm text-muted">Full name *</span>
              <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" autoComplete="name" />
            </label>

            <label className="block">
              <span className="text-sm text-muted">Email *</span>
              <Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" autoComplete="email" />
            </label>

            <label className="block">
              <span className="text-sm text-muted">Phone</span>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="04xx xxx xxx" autoComplete="tel" />
            </label>

            <label className="block">
              <span className="text-sm text-muted">Delivery address *</span>
              <textarea
                required
                rows={3}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street, suburb, state"
                className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-paper placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </label>

            <label className="block">
              <span className="text-sm text-muted">Postcode *</span>
              <Input
                required
                value={postcode}
                onChange={(e) => setPostcode(e.target.value)}
                placeholder="4215"
                autoComplete="postal-code"
                maxLength={4}
              />
            </label>

            <label className="block">
              <span className="text-sm text-muted">Order notes</span>
              <textarea
                className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-paper placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything we should know about your build?"
              />
            </label>
          </div>

          {!result.ok && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-300">
              Your build has compatibility issues that need to be resolved before you can check out.
              <Link to="/shop" className="ml-1 underline">
                Go back and fix them.
              </Link>
            </div>
          )}

          {stripeOn ? (
            <label className="flex items-start gap-3 rounded-lg border border-line px-4 py-3 text-sm">
              <input type="checkbox" className="mt-1" checked={payNow} onChange={(e) => setPayNow(e.target.checked)} />
              <span>
                Pay {depositPercent}% deposit now ({aud(depositInc)} inc GST). Uncheck to request the crate and invoice later.
              </span>
            </label>
          ) : null}

          <Button type="submit" disabled={placing || !result.ok} className="w-full text-base py-3">
            {placing ? "Working…" : stripeOn && payNow ? `Pay ${aud(depositInc)} deposit` : "Request this build"}
          </Button>

          <p className="text-center text-xs text-muted">
            {stripeOn
              ? "Card payments are processed by Stripe. The remaining balance is invoiced before the crate leaves."
              : "No payment is taken on this page until Stripe is connected. The workshop will send a deposit invoice."}
          </p>
        </section>
      </form>
    </div>
  );
}
