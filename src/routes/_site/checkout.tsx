import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/lib/es/cart-store";
import { fetchProducts } from "@/lib/es/product-cache";
import { placeGuestOrder, placeOrder } from "@/lib/es/server";
import { useServerQuote } from "@/lib/es/pricing";
import { fetchBillingConfig, notifyOrder, startDepositCheckout } from "@/lib/es/billing";
import { fetchAmbassadors, getCachedAmbassadorByCode } from "@/lib/es/ambassadors";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { aud, audExact } from "@/lib/utils";
import { pageHead } from "@/lib/es/seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckPills, LineName } from "@/components/es/bits";

export const Route = createFileRoute("/_site/checkout")({
  head: () =>
    pageHead({
      title: "Checkout | Everything Simulated",
      description: "Review your racing simulator build, verify compatibility and place your order.",
      path: "/checkout",
      index: false,
    }),
  component: Checkout,
});

function Checkout() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const { user } = useCurrentUserState();
  useQuery({ queryKey: ["products"], queryFn: () => fetchProducts() });
  const billing = useQuery({ queryKey: ["billing-config"], queryFn: fetchBillingConfig });
  const lines = useCart((s) => s.lines);
  const driverWeightKg = useCart((s) => s.driverWeightKg);
  const postcode = useCart((s) => s.postcode);
  const quoteId = useCart((s) => s.quoteId);
  const prebuildSlug = useCart((s) => s.prebuildSlug);
  const referralCode = useCart((s) => s.referralCode);
  const setReferralCode = useCart((s) => s.setReferralCode);
  const setPostcode = useCart((s) => s.setPostcode);
  const clear = useCart((s) => s.clear);
  useQuery({ queryKey: ["ambassadors"], queryFn: fetchAmbassadors });
  const referredBy = referralCode ? getCachedAmbassadorByCode(referralCode) : undefined;
  // What will actually be charged, priced by quote_cart() in the database.
  const quote = useServerQuote({ lines, postcode, prebuild: prebuildSlug, driverWeightKg });
  const q = quote.data;
  const blocks = (q?.issues ?? []).filter((i) => i.severity === "block");
  const canOrder = Boolean(q?.ok) && !quote.isFetching;

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
  const totalInc = q?.total_inc_gst ?? 0;
  const depositInc = Math.min(totalInc, Math.max(50000, Math.round((totalInc * depositPercent) / 100)));

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
        <h1 className="text-xl font-medium">Your build is empty</h1>
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
    if (!q?.ok) {
      toast.error(blocks[0]?.message ?? "Please fix the issues in your build before checking out.");
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
      const order = {
        lines,
        postcode,
        driverWeightKg,
        notes: notes.trim(),
        name: fullName,
        phone,
        address,
        prebuild: prebuildSlug,
        referralCode: referralCode || undefined,
      };
      const res = user
        ? await placeOrder({ ...order, quoteId: quoteId ?? undefined })
        : await placeGuestOrder({ ...order, email: mail });
      const id = res.id;
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
              {q && <CheckPills result={{ ok: q.ok, issues: q.issues, totalExGst: q.items_ex_gst, totalIncGst: q.total_inc_gst, freightExGst: q.freight_ex_gst, leadWeeks: q.lead_weeks }} />}
            </div>

            {quote.isPending ? (
              <div className="space-y-2 border-t border-line pt-3" aria-busy="true" aria-label="Pricing your build">
                {lines.map((l) => (
                  <div key={l.sku} className="h-4 animate-pulse rounded bg-raised" />
                ))}
                <div className="h-6 w-1/2 animate-pulse rounded bg-raised" />
              </div>
            ) : quote.isError && !q ? (
              <div role="alert" className="space-y-2 border-t border-line pt-3 text-sm">
                <p>We couldn't price this build right now.</p>
                <Button type="button" size="sm" variant="outline" onClick={() => void quote.refetch()}>
                  Try again
                </Button>
              </div>
            ) : q ? (
              <>
                {q.mode === "package" && (
                  <p className="border-t border-line pt-3 text-sm">
                    Package price {aud(q.package_ex_gst ?? 0)} + GST, parts included.
                  </p>
                )}
                <ul className="space-y-2 border-t border-line pt-3" aria-live="polite">
                  {q.lines.map((line) => (
                    <li key={line.sku} className="flex justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate">
                        <LineName sku={line.sku} />
                        {line.qty > 1 && <span className="ml-1 text-muted">x{line.qty}</span>}
                      </span>
                      <span className="shrink-0 tabular-nums text-muted">
                        {line.included ? "Included" : line.unit_ex_gst > 0 ? aud(line.line_ex_gst) : "Enquire"}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="space-y-1 border-t border-line pt-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">Subtotal (ex GST)</span>
                    <span className="tabular-nums">{aud(q.items_ex_gst)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">Freight: {q.freight.zone}</span>
                    <span className="tabular-nums">{aud(q.freight_ex_gst)}</span>
                  </div>
                  <ul className="space-y-0.5 text-xs text-muted">
                    {q.freight.breakdown.map((row) => (
                      <li key={row.label} className="flex justify-between gap-3">
                        <span>{row.label}</span>
                        <span className="tabular-nums">{aud(row.cents)}</span>
                      </li>
                    ))}
                    <li>
                      {q.freight.kg} kg · {q.freight.crates} crate{q.freight.crates === 1 ? "" : "s"} from the Gold Coast
                    </li>
                  </ul>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">GST</span>
                    <span className="tabular-nums">{aud(q.gst_cents)}</span>
                  </div>
                  <div className="flex justify-between pt-2 text-lg font-medium">
                    <span>Total inc GST</span>
                    <span className="tabular-nums" data-testid="checkout-total">{aud(q.total_inc_gst)}</span>
                  </div>
                  {stripeOn ? (
                    <p className="text-xs text-muted">
                      Deposit due today {audExact(depositInc)} inc GST ({depositPercent}%, minimum $500).
                    </p>
                  ) : null}
                  {q.lead_weeks[1] > 0 && (
                    <p className="text-xs text-muted">
                      Estimated lead time {q.lead_weeks[0]}–{q.lead_weeks[1]} weeks
                    </p>
                  )}
                </div>
              </>
            ) : null}

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

            <label className="block">
              <span className="text-sm text-muted">Ambassador code / voucher / gift card</span>
              <Input
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
                placeholder="e.g. COSGROVE"
                autoComplete="off"
              />
              <span className="mt-1 block text-xs text-muted">
                {referredBy
                  ? `This crate will be attributed to ${referredBy.name}. It does not change the price.`
                  : "Enter an ambassador code, voucher or gift card if you have one."}
              </span>
            </label>
          </div>

          {blocks.length > 0 && (
            <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-300">
              <ul className="list-disc space-y-1 pl-4">
                {blocks.map((b) => (
                  <li key={b.code + (b.sku ?? "")}>{b.message}</li>
                ))}
              </ul>
              <p className="mt-2">
                <Link to="/shop" className="underline">Edit your build</Link>
                {" or "}
                <Link to="/contact" className="underline">send it to us as an enquiry</Link>.
              </p>
            </div>
          )}

          {stripeOn ? (
            <label className="flex items-start gap-3 rounded-lg border border-line px-4 py-3 text-sm">
              <input type="checkbox" className="mt-1" checked={payNow} onChange={(e) => setPayNow(e.target.checked)} />
              <span>
                Pay {depositPercent}% deposit now ({audExact(depositInc)} inc GST). Uncheck to request the crate and invoice later.
              </span>
            </label>
          ) : null}

          <Button type="submit" disabled={placing || !canOrder} className="w-full text-base py-3">
            {placing ? "Working…" : stripeOn && payNow ? `Pay ${audExact(depositInc)} deposit` : "Request this build"}
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
