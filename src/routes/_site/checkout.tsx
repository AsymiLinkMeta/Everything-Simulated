import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/lib/es/cart-store";
import { fetchProducts } from "@/lib/es/product-cache";
import { placeGuestOrder, placeOrder } from "@/lib/es/server";
import { freightLabel } from "@/lib/es/freight";
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
  const lines = useCart((s) => s.lines);
  const driverWeightKg = useCart((s) => s.driverWeightKg);
  const postcode = useCart((s) => s.postcode);
  const setPostcode = useCart((s) => s.setPostcode);
  const clear = useCart((s) => s.clear);
  const result = useCart((s) => s.result)();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [placing, setPlacing] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (user?.email) setEmail(user.email);
    if (user?.user_metadata?.display_name) setName(user.user_metadata.display_name as string);
  }, [user]);

  if (!ready) {
    return <div className="mx-auto max-w-3xl animate-pulse py-20" />;
  }

  if (orderId) {
    return (
      <div className="mx-auto max-w-lg px-5 py-20 text-center">
        <div className="mx-auto mb-6 grid size-16 place-items-center rounded-full bg-emerald-500/10">
          <Check className="size-8 text-emerald-400" />
        </div>
        <h1 className="text-2xl font-medium">Order confirmed</h1>
        <p className="mt-2 text-muted">
          Your order <span className="font-mono text-paper">{orderId}</span> has been received.
          Our team will be in touch to arrange a deposit and confirm your build.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button variant="outline" asChild>
            <Link to="/order">Track this order</Link>
          </Button>
          <Button asChild>
            <Link to="/">Back to home</Link>
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
    setPlacing(true);
    try {
      let id: string;
      if (user) {
        const res = await placeOrder({ lines, postcode, driverWeightKg, notes });
        id = res.id;
      } else {
        const res = await placeGuestOrder({ lines, postcode, driverWeightKg, name, email, phone, notes });
        id = res.id;
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
        Review your build, enter your details, and submit. We'll follow up to arrange a deposit.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 grid gap-8 lg:grid-cols-5">
        {/* Order summary — right on desktop, top on mobile */}
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
                <span className="text-muted">Freight — {freightLabel(postcode)}</span>
                <span className="tabular-nums">{aud(result.freightExGst)}</span>
              </div>
              <div className="flex justify-between pt-2 text-lg font-medium">
                <span>Total inc GST</span>
                <span className="tabular-nums">{aud(gstInclusive(result.totalExGst + result.freightExGst))}</span>
              </div>
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

        {/* Contact form — left on desktop */}
        <section className="lg:col-span-3 space-y-6">
          <div className="es-card space-y-4 p-5">
            <h2 className="font-medium">Your details</h2>
            {!user && (
              <p className="text-xs text-muted">
                Already have an account?{" "}
                <Link to="/login" className="underline hover:text-paper">
                  Sign in
                </Link>{" "}
                for a faster checkout.
              </p>
            )}

            <label className="block">
              <span className="text-sm text-muted">Full name *</span>
              <Input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Smith"
                autoComplete="name"
              />
            </label>

            <label className="block">
              <span className="text-sm text-muted">Email *</span>
              <Input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@example.com"
                autoComplete="email"
              />
            </label>

            <label className="block">
              <span className="text-sm text-muted">Phone</span>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="04xx xxx xxx"
                autoComplete="tel"
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

          <Button type="submit" disabled={placing || !result.ok} className="w-full text-base py-3">
            {placing ? "Placing order..." : "Place order"}
          </Button>

          <p className="text-center text-xs text-muted">
            No payment is taken now. Our team will follow up to confirm your build and arrange a deposit invoice.
          </p>
        </section>
      </form>
    </div>
  );
}
