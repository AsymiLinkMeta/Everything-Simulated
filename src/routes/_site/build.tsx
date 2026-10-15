import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Link2, Save, X } from "lucide-react";
import { toast } from "@/lib/toast";
import { fetchProducts } from "@/lib/es/product-cache";
import { fetchPublishedPrebuilds } from "@/lib/es/prebuilds";
import { checkCart, UNIQUE_CATEGORIES } from "@/lib/es/checkCart";
import { useCart } from "@/lib/es/cart-store";
import { useServerQuote } from "@/lib/es/pricing";
import { saveQuote } from "@/lib/es/server";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { fetchBuilderData } from "@/lib/es/builder";
import {
  BUILDER_STEPS,
  badgeLabel,
  decodeBuild,
  encodeBuild,
  filterAndSort,
  layerStack,
  newIssues,
  stepForCategory,
  withPick,
  withoutSku,
  type BuilderSort,
} from "@/lib/es/builder-core";
import { stockLabel } from "@/lib/es/stock";
import { pageHead, breadcrumbLd } from "@/lib/es/seo";
import { STAGE_IMAGES } from "@/lib/es/stage-images";
import { JsonLd, Money } from "@/components/es/bits";
import { PageHero } from "@/components/es/section-page";
import { ProductPhoto } from "@/components/es/product-photo";
import { RigPreview } from "@/components/es/rig-preview";
import { Button } from "@/components/ui/button";
import { aud } from "@/lib/utils";
import { productImage } from "@/lib/es/product-cache";
import type { Product } from "@/lib/es/types";

export const Route = createFileRoute("/_site/build")({
  head: () =>
    pageHead({
      title: "Rig Builder: Build a Sim Racing Rig Step by Step | Everything Simulated",
      description:
        "Pick a chassis, wheelbase, wheel, pedals, seat, screens, motion and PC one step at a time. Live AUD pricing and a compatibility check on every part.",
      path: "/build",
    }),
  component: RigBuilder,
});

type Card = Product & { badge?: string | null };

/** "simagic_qr" -> "Simagic QR". */
function qrLabel(qr: string) {
  const base = qr.replace(/[_-]?qr$/i, "").replace(/[_-]+/g, " ").trim();
  return `${base.replace(/\b\w/g, (c) => c.toUpperCase())} QR`.trim();
}

const DESKTOP = "(min-width: 1024px)";
/** True on the two-column layout, where the preview sits in the sticky side panel; on phones it leads the step. */
function useDesktopLayout() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(DESKTOP);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(DESKTOP).matches,
    () => true,
  );
}

function RigBuilder() {
  const [params, setParams] = useSearchParams();
  const products = useQuery({ queryKey: ["products"], queryFn: () => fetchProducts() });
  const builder = useQuery({ queryKey: ["builder-data"], queryFn: fetchBuilderData, staleTime: 10 * 60_000 });
  const prebuilds = useQuery({ queryKey: ["prebuilds-published"], queryFn: fetchPublishedPrebuilds });
  const { user } = useCurrentUserState();

  const lines = useCart((s) => s.lines);
  const prebuildSlug = useCart((s) => s.prebuildSlug);
  const postcode = useCart((s) => s.postcode);
  const driverWeightKg = useCart((s) => s.driverWeightKg);
  const setLines = useCart((s) => s.setLines);

  const stepParam = params.get("step");
  const stepIndex = Math.max(0, BUILDER_STEPS.findIndex((s) => s.id === stepParam));
  const step = BUILDER_STEPS[stepIndex];
  const [sort, setSort] = useState<BuilderSort>("recommended");
  const [brand, setBrand] = useState("");
  const [cat, setCat] = useState("");
  const [inStock, setInStock] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const ids = useId();

  // A shared link (?b=sku,sku*2) loads that build once the catalogue is in.
  const sharedRaw = params.get("b");
  const loadedShare = useRef(false);
  useEffect(() => {
    if (loadedShare.current || !sharedRaw || !products.data) return;
    loadedShare.current = true;
    const known = new Set(products.data.map((p) => p.sku));
    const shared = decodeBuild(sharedRaw).filter((l) => known.has(l.sku));
    if (shared.length) {
      setLines(shared, null, null);
      toast.success("Shared build loaded");
    } else toast.error("That build link has no parts we still sell");
    const next = new URLSearchParams(params);
    next.delete("b");
    setParams(next, { replace: true });
  }, [sharedRaw, products.data, params, setParams, setLines]);

  const map = useMemo(() => Object.fromEntries((products.data ?? []).map((p) => [p.sku, p])), [products.data]);
  const picked = useMemo(() => lines.map((l) => map[l.sku]).filter(Boolean) as Product[], [lines, map]);
  const pickedCats = useMemo(() => new Set(picked.map((p) => p.category as string)), [picked]);
  const desktop = useDesktopLayout();
  const screens = useMemo(() => lines.reduce((n, l) => n + (map[l.sku]?.category === "monitor" ? l.qty || 1 : 0), 0), [lines, map]);
  const result = useMemo(() => checkCart({ lines, products: map, driverWeightKg, postcode }), [lines, map, driverWeightKg, postcode]);
  const quote = useServerQuote({ lines, postcode, prebuild: prebuildSlug, driverWeightKg }, { enabled: lines.length > 0 });

  const stepItems: Card[] = useMemo(() => {
    const badges = builder.data?.badges ?? {};
    return (products.data ?? []).filter((p) => (step.categories as string[]).includes(p.category)).map((p) => ({ ...p, badge: badges[p.sku] ?? null }));
  }, [products.data, builder.data, step]);
  const brands = useMemo(() => [...new Set(stepItems.map((p) => p.brand))].sort(), [stepItems]);
  const shown = useMemo(() => filterAndSort(stepItems, { brand: brand || undefined, category: cat || undefined, inStockOnly: inStock }, sort), [stepItems, brand, cat, inStock, sort]);

  function goStep(i: number) {
    const next = new URLSearchParams(params);
    next.set("step", BUILDER_STEPS[i].id);
    setParams(next, { replace: false });
    setBrand("");
    setCat("");
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  function choose(item: Product) {
    setLines(withPick(lines, item, map, UNIQUE_CATEGORIES), null, prebuildSlug);
  }
  function drop(sku: string) {
    setLines(withoutSku(lines, sku), null, prebuildSlug);
  }

  function startFrom(slug: string) {
    const pb = prebuilds.data?.find((p) => p.slug === slug);
    if (!pb) return;
    const next = (pb.components ?? []).filter((c) => map[c.sku]).map((c) => ({ sku: c.sku, qty: c.qty || 1 }));
    setLines(next, null, slug);
    toast.success(`Started from ${pb.name}. Swap any part below.`);
  }

  async function share() {
    const url = `${window.location.origin}/build?b=${encodeURIComponent(encodeBuild(lines)).replace(/%2C/g, ",")}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Build link copied");
    } catch {
      window.prompt("Copy this link to share your build", url);
    }
  }

  async function save() {
    if (!user) {
      toast.message("Sign in to save this build to your account.");
      return;
    }
    try {
      const saved = await saveQuote({ lines, postcode, title: "Rig builder", driverWeightKg });
      toast.success(`Saved as quote ${saved.id}`);
    } catch {
      toast.error("Could not save the build. Try again.");
    }
  }

  const q = quote.data;
  const blocked = result.issues.some((i) => i.severity === "block") || (q ? !q.ok : false);
  const total = q?.total_inc_gst ?? null;

  const preview = <RigPreview layers={layerStack(picked, builder.data?.layers ?? [])} picked={pickedCats} screens={screens} />;
  return (
    <div>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Rig builder", path: "/build" }])} />
      <PageHero
        kicker="Rig builder"
        title="Build your rig, step by step"
        lead="Nine steps, live prices from the workshop catalogue, and a compatibility check on every part before you pay a deposit."
        image={STAGE_IMAGES["/compatibility"]}
      />

      <div className="es-body es-rb">
        {prebuilds.data?.length ? (
          <section className="es-rb-start" aria-labelledby={`${ids}-start`}>
            <h2 id={`${ids}-start`} className="es-kicker">Start from a prebuild</h2>
            <div className="es-rb-start-row">
              {prebuilds.data.map((p) => (
                <button key={p.slug} type="button" className={`es-rb-chip ${prebuildSlug === p.slug ? "is-on" : ""}`} aria-pressed={prebuildSlug === p.slug} onClick={() => startFrom(p.slug)}>
                  {p.name}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <nav aria-label="Build steps" className="es-rb-steps">
          <ol>
            {BUILDER_STEPS.map((s, i) => {
              const inStep = picked.filter((p) => (s.categories as string[]).includes(p.category));
              return (
                <li key={s.id}>
                  <button type="button" onClick={() => goStep(i)} aria-current={i === stepIndex ? "step" : undefined} className={`es-rb-step ${i === stepIndex ? "is-current" : ""} ${inStep.length ? "is-done" : ""}`}>
                    <span className="es-rb-step-n" aria-hidden="true">{inStep.length ? <Check className="size-3.5" /> : i + 1}</span>
                    <span className="es-rb-step-text">
                      <span className="es-rb-step-label">{s.label}</span>
                      <span className="es-rb-step-pick">{inStep.length ? inStep.map((p) => p.name).join(", ") : "Not picked"}</span>
                    </span>
                    <span className="sr-only">{`Step ${i + 1}`}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="es-rb-grid">
          {desktop ? null : preview}
          <section className="min-w-0" aria-labelledby={`${ids}-step`}>
            <div className="es-rb-head">
              <p className="es-kicker">
                Step {stepIndex + 1} of {BUILDER_STEPS.length}
              </p>
              <h2 id={`${ids}-step`} ref={headingRef} tabIndex={-1} className="es-rb-title">
                {step.label}
              </h2>
              <p className="text-sm text-muted">{step.hint}</p>
            </div>

            <div className="es-rb-filters" role="group" aria-label="Filter and sort">
              {step.categories.length > 1 ? (
                <label>
                  <span>Type</span>
                  <select value={cat} onChange={(e) => setCat(e.target.value)}>
                    <option value="">All</option>
                    {step.categories.map((c) => (
                      <option key={c} value={c}>
                        {c[0].toUpperCase() + c.slice(1)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label>
                <span>Brand</span>
                <select value={brand} onChange={(e) => setBrand(e.target.value)}>
                  <option value="">All brands</option>
                  {brands.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Sort</span>
                <select value={sort} onChange={(e) => setSort(e.target.value as BuilderSort)}>
                  <option value="recommended">Recommended</option>
                  <option value="price-asc">Price: low to high</option>
                  <option value="price-desc">Price: high to low</option>
                  {step.id === "wheelbase" ? <option value="torque">Most torque</option> : null}
                </select>
              </label>
              <label className="es-rb-check">
                <input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} />
                <span>In stock only</span>
              </label>
            </div>

            {products.isPending ? (
              <div className="es-rb-cards">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="es-rb-card h-80 animate-pulse" />
                ))}
              </div>
            ) : products.isError ? (
              <p className="es-card p-5 text-sm text-muted">Could not load the catalogue. Refresh to try again.</p>
            ) : shown.length === 0 ? (
              <p className="es-card p-5 text-sm text-muted">
                {stepItems.length ? "Nothing matches those filters." : "Nothing listed for this step yet."}{" "}
                {stepIndex < BUILDER_STEPS.length - 1 ? "You can skip it." : null}
              </p>
            ) : (
              <ul className="es-rb-cards" aria-label={`${step.label} options`}>
                {shown.map((item) => {
                  const isPicked = lines.some((l) => l.sku === item.sku);
                  const after = isPicked ? result : checkCart({ lines: withPick(lines, item, map, UNIQUE_CATEGORIES), products: map, driverWeightKg, postcode });
                  const why = isPicked ? result.issues.filter((i) => i.severity !== "allow" && i.message.includes(item.name)) : newIssues(result.issues, after.issues);
                  const blocks = why.filter((i) => i.severity === "block");
                  const badge = badgeLabel(item.badge);
                  const stock = stockLabel(item.stock);
                  const price = item.sellExGst > 0 && item.purchasable !== false;
                  return (
                    <li key={item.sku}>
                      <article className={`es-rb-card ${isPicked ? "is-picked" : ""} ${blocks.length ? "is-blocked" : ""}`} aria-labelledby={`${ids}-${item.sku}`} data-testid={`builder-card-${item.sku}`}>
                        <div className="es-rb-card-photo">
                          <ProductPhoto src={productImage(item)} alt={item.name} label={item.brand} sizes="(min-width: 1024px) 22vw, 90vw" />
                          {badge ? <span className="es-rb-badge" data-testid="builder-badge">{badge}</span> : null}
                        </div>
                        <div className="es-rb-card-body">
                          <p className="es-kicker">{item.brand}</p>
                          <h3 id={`${ids}-${item.sku}`} className="es-rb-card-name">
                            {item.name}
                          </h3>
                          <ul className="es-rb-specs">
                            {item.maxNm ? <li>{item.maxNm} Nm</li> : null}
                            {item.payloadKg ? <li>{item.payloadKg} kg payload</li> : null}
                            {item.qr ? <li>{qrLabel(item.qr)}</li> : null}
                            {stock.short ? <li title={stock.long}>{stock.short}</li> : null}
                          </ul>
                          <p className="es-rb-price">{price ? <Money cents={item.sellExGst} gst /> : "Enquire for price"}</p>
                          {why.length ? (
                            <ul className="es-rb-why" data-testid="builder-conflict">
                              {why.map((i) => (
                                <li key={`${i.code}-${i.message}`} className={i.severity === "block" ? "is-block" : "is-warn"}>
                                  <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
                                  <span>
                                    <strong>{i.severity === "block" ? "Won't work: " : i.severity === "adapter" ? "Needs an adapter: " : "Check: "}</strong>
                                    {i.message}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                          <div className="es-rb-card-actions">
                            {isPicked ? (
                              <>
                                <span className="es-rb-picked">
                                  <Check className="size-4" aria-hidden="true" /> In your build
                                </span>
                                <button type="button" className="es-rb-remove" onClick={() => drop(item.sku)} aria-label={`Remove ${item.name}`}>
                                  <X className="size-4" aria-hidden="true" /> Remove
                                </button>
                              </>
                            ) : (
                              <Button variant="outline" disabled={!price || blocks.length > 0} onClick={() => choose(item)} aria-describedby={blocks.length ? `${ids}-${item.sku}` : undefined}>
                                {!price ? "Enquire only" : blocks.length ? "Doesn't fit this build" : step.single && step.categories.some((c) => pickedCats.has(c)) ? "Swap to this" : "Choose"}
                              </Button>
                            )}
                          </div>
                        </div>
                      </article>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="es-rb-nav">
              <Button variant="ghost" disabled={stepIndex === 0} onClick={() => goStep(stepIndex - 1)}>
                <ChevronLeft className="size-4" aria-hidden="true" /> Back
              </Button>
              {stepIndex < BUILDER_STEPS.length - 1 ? (
                <Button variant="outline" onClick={() => goStep(stepIndex + 1)}>
                  {step.categories.some((c) => pickedCats.has(c)) ? "Next" : "Skip"}: {BUILDER_STEPS[stepIndex + 1].label} <ChevronRight className="size-4" aria-hidden="true" />
                </Button>
              ) : null}
            </div>
          </section>

          <aside className="es-rb-side" aria-label="Your build">
            {desktop ? preview : null}
            <div className="es-rb-summary">
              <p className="es-kicker">Your build</p>
              {picked.length ? (
                <ul className="es-rb-lines">
                  {lines.map((l) => {
                    const p = map[l.sku];
                    if (!p) return null;
                    return (
                      <li key={l.sku}>
                        <span className="min-w-0 truncate">
                          {l.qty > 1 ? `${l.qty} × ` : ""}
                          {p.name}
                        </span>
                        <span className="tabular-nums text-muted">{p.sellExGst > 0 ? aud(p.sellExGst * l.qty) : "—"}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted">Nothing picked yet. Start from a prebuild or choose a chassis.</p>
              )}
              {result.issues.filter((i) => i.severity === "block").length ? (
                <p className="es-rb-alert" role="status">
                  <AlertTriangle className="size-4 shrink-0" aria-hidden="true" /> {result.issues.find((i) => i.severity === "block")?.message}
                </p>
              ) : null}
            </div>
          </aside>
        </div>
      </div>

      <div className="es-rb-total-spacer" aria-hidden="true" />
      <div className="es-rb-total" role="region" aria-label="Build total" data-testid="builder-total">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">
            {picked.length} part{picked.length === 1 ? "" : "s"}
            {q?.mode === "package" ? " · prebuild price" : ""}
            {stepForCategory("motion") && pickedCats.has("motion") && driverWeightKg == null ? " · motion checked at 80 kg" : ""}
          </p>
          <p className="es-rb-total-price tabular-nums" aria-live="polite">
            {!lines.length ? "$0" : total == null ? "Pricing…" : <>{aud(total)} <span className="text-xs text-muted">inc GST{postcode.length === 4 ? " & freight" : ", freight estimate"}</span></>}
          </p>
        </div>
        <div className="es-rb-total-actions">
          <button type="button" className="es-rb-icon" onClick={() => void save()} disabled={!lines.length} aria-label="Save build">
            <Save className="size-4" aria-hidden="true" /> <span>Save</span>
          </button>
          <button type="button" className="es-rb-icon" onClick={() => void share()} disabled={!lines.length} aria-label="Copy share link">
            <Link2 className="size-4" aria-hidden="true" /> <span>Share</span>
          </button>
          {lines.length && !blocked ? (
            <Link to="/checkout" className="es-btn">
              Checkout
            </Link>
          ) : (
            <button type="button" className="es-btn" disabled aria-disabled="true" title={blocked ? "Fix the parts that don't fit first" : "Pick a part first"}>
              Checkout
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
