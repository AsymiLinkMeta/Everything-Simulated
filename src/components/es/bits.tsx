import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Plus, X, Wrench, Loader2 } from "lucide-react";
import "../../es.css";
import { Link } from "@tanstack/react-router";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { aud, gstInclusive } from "@/lib/utils";
import type { CheckIssue, CheckResult, PackageSpec, Product, CartLine } from "@/lib/es/types";
import { product, productImage, getCachedProductMap } from "@/lib/es/product-cache";
import { useCart } from "@/lib/es/cart-store";
import { checkCart } from "@/lib/es/checkCart";
import { askBuilder } from "@/lib/es/server";
import { cn } from "@/lib/utils";

export function BackButton({ label = "Back" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.history.back()}
      className="mb-6 inline-flex min-h-11 items-center gap-2 rounded-md border border-line px-4 text-sm text-muted transition-colors hover:border-esred hover:text-paper"
    >
      <ArrowLeft className="size-4" />
      {label}
    </button>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className={`es-logo${compact ? " es-logo-compact" : ""}`} aria-label="Everything Simulated">
      <picture>
        <img
          src="/Everything_Simulated_LOGO_W+R.png"
          alt="Everything Simulated"
          className="es-logo-image"
        />
      </picture>
    </Link>
  );
}

export function CustomerSignInLink({ className }: { className?: string }) {
  return (
    <Link to="/login" className={className ?? "es-nav-link es-header-signin"}>
      Customer Sign In
    </Link>
  );
}

export function AuthSlot() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return <div className="h-8 w-24 animate-pulse rounded-md bg-raised" />;
  if (user) return <UserButton />;
  return <CustomerSignInLink />;
}

export function StaffLoginLink() {
  return (
    <a href="/login?portal=staff" className="es-footer-login" aria-label="Staff login">
      Staff / Admin Login
    </a>
  );
}

const COOKIE_KEY = "es-cookie-ack";

export function CookieDisclaimer() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(COOKIE_KEY) === "1";
    } catch {
      return false;
    }
  });
  if (dismissed) return null;
  return (
    <div className="es-cookie-bar">
      <p>
        We use essential cookies to keep you signed in and the cart working. By continuing you accept our use of cookies.{" "}
        <Link to="/privacy" className="es-cookie-link">Privacy policy</Link>
      </p>
      <button
        type="button"
        className="es-cookie-close"
        aria-label="Dismiss cookie notice"
        onClick={() => {
          try {
            localStorage.setItem(COOKIE_KEY, "1");
          } catch {
            // ignore storage errors (private mode, quota, etc.)
          }
          setDismissed(true);
        }}
      >
        OK
      </button>
    </div>
  );
}

export function JsonLd({ data }: { data: unknown }) {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}

export function Money({ cents, gst = false }: { cents: number; gst?: boolean }) {
  if (!cents) {
    return <span className="text-muted">Quote</span>;
  }
  if (gst) {
    return (
      <span className="tabular-nums">
        {aud(cents)} <span className="text-muted">+ GST</span>
      </span>
    );
  }
  return <span className="tabular-nums">{aud(cents)}</span>;
}

export function IncGst({ cents }: { cents: number }) {
  return <span className="tabular-nums text-muted">{aud(gstInclusive(cents))} inc GST</span>;
}

export function CheckPills({ result }: { result: CheckResult }) {
  const blocks = result.issues.filter((i) => i.severity === "block");
  const warns = result.issues.filter((i) => i.severity !== "block");
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      <span
        className={cn(
          "rounded-md px-2 py-1",
          result.ok ? "bg-ok/15 text-ok" : "bg-esred/15 text-esred",
        )}
      >
        {result.ok ? "Compatible" : `${blocks.length} block${blocks.length === 1 ? "" : "s"}`}
      </span>
      {warns.length ? (
        <span className="rounded-md bg-warn/15 px-2 py-1 text-warn">{warns.length} notes</span>
      ) : null}
      <span className="rounded-md bg-raised px-2 py-1 text-muted">
        {result.leadWeeks[0]}–{result.leadWeeks[1]} wks
      </span>
    </div>
  );
}

export function IssueList({ issues }: { issues: CheckIssue[] }) {
  if (!issues.length) {
    return <p className="text-sm text-ok">This cart is compatible. Ready to quote.</p>;
  }
  return (
    <ul className="space-y-2">
      {issues.map((issue) => (
        <IssueRow key={issue.code + issue.message} issue={issue} />
      ))}
    </ul>
  );
}

type Recommendation = {
  id: string;
  reason: string;
  newLines: CartLine[];
};

function IssueRow({ issue }: { issue: CheckIssue }) {
  const lines = useCart((s) => s.lines);
  const setLines = useCart((s) => s.setLines);
  const driverWeightKg = useCart((s) => s.driverWeightKg);
  const [fixing, setFixing] = useState(false);
  const [rec, setRec] = useState<Recommendation | null>(null);

  const borderClass =
    issue.severity === "block"
      ? "border-esred/50"
      : issue.severity === "warn"
        ? "border-warn/50"
        : issue.severity === "adapter"
          ? "border-blue-500/40"
          : "border-line";

  async function handleFix() {
    setFixing(true);
    try {
      const res = await askBuilder({
        message: `Fix this compatibility issue: ${issue.message}. Suggest the minimal cart change needed. Return ONLY a JSON object with "reason" (a few words) and "lines" (the full replacement cart array of {sku,qty}).`,
        lines,
        driverWeightKg,
        task: "compatibility",
      });
      const parsed = extractRecommendation(res.reply);
      if (parsed) {
        setRec({ id: issue.code, ...parsed });
      } else {
        toast.error("Could not generate a fix. Try the build expert chat.");
      }
    } catch {
      toast.error("Could not reach the AI agent. Try again shortly.");
    } finally {
      setFixing(false);
    }
  }

  function applyRec() {
    if (!rec) return;
    const map = getCachedProductMap();
    const valid = rec.newLines.filter((l) => l.sku && l.qty > 0 && map[l.sku]);
    if (!valid.length) {
      toast.error("The suggested parts could not be verified.");
      return;
    }
    setLines(valid);
    setRec(null);
    toast.success("Cart updated with the recommended fix");
  }

  return (
    <li className={cn("rounded-md border px-3 py-2 text-sm", borderClass)}>
      <p className="font-medium capitalize">{issue.severity}</p>
      <p className="text-muted">{issue.message}</p>
      {issue.fix && issue.fix.length > 0 && (
        <p className="mt-1 text-xs text-muted">Suggested: {issue.fix.join(". ")}</p>
      )}
      {issue.adapterSku && <AddAdapterButton sku={issue.adapterSku} />}
      {rec ? (
        <div className="mt-2 flex items-start justify-between gap-2 rounded-md bg-raised p-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted">Recommendation</p>
            <p className="text-sm text-paper">{rec.reason}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={applyRec}
              className="rounded-md bg-esred px-2 py-1 text-xs font-medium text-paper transition-colors hover:bg-esred/80"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={() => setRec(null)}
              aria-label="Dismiss recommendation"
              className="grid size-6 place-items-center rounded-md text-muted transition-colors hover:text-paper"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={fixing}
          onClick={handleFix}
          className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-xs text-muted transition-colors hover:border-esred hover:text-paper disabled:opacity-50"
        >
          {fixing ? <Loader2 className="size-3 animate-spin" /> : <Wrench className="size-3" />}
          {fixing ? "Fixing…" : "Fix"}
        </button>
      )}
    </li>
  );
}

function AddAdapterButton({ sku }: { sku: string }) {
  const add = useCart((s) => s.add);
  const p = product(sku);
  return (
    <button
      type="button"
      onClick={() => {
        add(sku);
        toast.success(`Added ${p ? p.name : sku}`);
      }}
      className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-blue-500/40 px-2 py-1 text-xs text-blue-400 transition-colors hover:bg-blue-500/10"
    >
      <Plus className="size-3" />
      Add {p ? p.name : sku}
    </button>
  );
}

function extractRecommendation(reply: string): { reason: string; newLines: CartLine[] } | null {
  try {
    const jsonMatch = reply.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const obj = JSON.parse(jsonMatch[0]);
    if (!obj.lines || !Array.isArray(obj.lines)) return null;
    const newLines = obj.lines
      .filter((l: unknown) => typeof l === "object" && l !== null && "sku" in l && "qty" in l)
      .map((l: Record<string, unknown>) => ({ sku: String(l.sku), qty: Number(l.qty) || 1 }));
    if (!newLines.length) return null;
    return { reason: String(obj.reason ?? "Better balance for this build"), newLines };
  } catch {
    return null;
  }
}

export function PackageCard({ pack }: { pack: PackageSpec }) {
  return (
    <Link to="/prebuilds/$slug" params={{ slug: pack.slug }} className="es-card group flex flex-col overflow-hidden">
      <div className="relative aspect-video overflow-hidden">
        <img src={pack.image} alt={pack.name} className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
        <span className="es-kicker" style={{ position: "absolute", left: 16, top: 16, background: "rgba(7,7,8,0.8)", padding: "4px 8px", borderRadius: 8 }}>
          {pack.kicker}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <h3 className="text-xl font-medium">{pack.name}</h3>
        <p className="text-sm text-muted">{pack.blurb}</p>
        <p className="mt-auto text-lg font-medium">
          <Money cents={pack.priceExGst} gst />
        </p>
      </div>
    </Link>
  );
}

export function ProductTile({ item }: { item: Product }) {
  const add = useCart((s) => s.add);
  return (
    <Link to="/shop/$sku" params={{ sku: item.sku }} className="es-card group overflow-hidden">
      <div className="relative aspect-video bg-raised">
        <img src={productImage(item)} alt={item.name} className="size-full object-cover opacity-90" />
        <button
          type="button"
          aria-label={`Add ${item.name} to cart`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            add(item.sku);
            toast.success("Added to cart", {
              description: <span className="text-emerald-400">Scroll down to view your cart.</span>,
            });
          }}
          className="absolute bottom-2 right-2 z-10 grid size-9 place-items-center rounded-full bg-paper text-ink shadow-lg transition-all duration-200 hover:scale-110"
        >
          <Plus className="size-4" />
        </button>
      </div>
      <div className="space-y-1 p-4">
        <p className="es-kicker">{item.brand}</p>
        <h3 className="font-medium">{item.name}</h3>
        <p className="text-sm text-muted">
          <Money cents={item.sellExGst} gst />
        </p>
      </div>
    </Link>
  );
}

export function LineName({ sku }: { sku: string }) {
  const p = product(sku);
  return <span>{p ? `${p.brand} ${p.name}` : sku}</span>;
}
