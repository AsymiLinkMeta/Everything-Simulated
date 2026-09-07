import { Link } from "@tanstack/react-router";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { aud, gstInclusive } from "@/lib/utils";
import type { CheckIssue, CheckResult, PackageSpec, Product } from "@/lib/es/types";
import { product, productImage } from "@/lib/es/catalog";
import { cn } from "@/lib/utils";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-3 text-paper">
      <span className="grid size-9 place-items-center rounded-md bg-esred text-xs font-semibold tracking-widest">
        ES
      </span>
      {compact ? null : (
        <span className="text-sm font-medium tracking-wide">
          Everything
          <span className="block text-xs font-normal text-muted">Simulated</span>
        </span>
      )}
    </Link>
  );
}

export function AuthSlot() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return <div className="h-8 w-24 animate-pulse rounded-md bg-raised" />;
  if (user) return <UserButton />;
  return (
    <Link
      to="/login"
      className="inline-flex min-h-11 items-center px-3 text-sm text-muted hover:text-paper"
    >
      Sign in
    </Link>
  );
}

export function JsonLd({ data }: { data: unknown }) {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}

export function Money({ cents, gst = false }: { cents: number; gst?: boolean }) {
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
        <li
          key={issue.code + issue.message}
          className={cn(
            "rounded-md border px-3 py-2 text-sm",
            issue.severity === "block"
              ? "border-esred/40 text-paper"
              : issue.severity === "warn"
                ? "border-warn/40"
                : "border-line",
          )}
        >
          <p className="font-medium capitalize">{issue.severity}</p>
          <p className="text-muted">{issue.message}</p>
        </li>
      ))}
    </ul>
  );
}

export function PackageCard({ pack }: { pack: PackageSpec }) {
  return (
    <Link
      to="/builds/$slug"
      params={{ slug: pack.slug }}
      className="es-card group flex flex-col overflow-hidden"
    >
      <div className="relative aspect-video overflow-hidden">
        <img src={pack.image} alt={pack.name} className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
        <span className="absolute left-4 top-4 rounded-md bg-ink/80 px-2 py-1 text-xs uppercase tracking-widest">
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
  return (
    <Link to="/shop/$sku" params={{ sku: item.sku }} className="es-card overflow-hidden">
      <div className="aspect-video bg-raised">
        <img src={productImage(item)} alt={item.name} className="size-full object-cover opacity-90" />
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
