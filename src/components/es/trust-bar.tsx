import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Clock, ShieldCheck, Star } from "lucide-react";
import { fetchTrustSettings, trustItems, type TrustItem } from "@/lib/es/site-settings";

const ICONS = { google: Star, try: BadgeCheck, lead: Clock, warranty: ShieldCheck } as const;

/** Facts the workshop has entered in Staff → Site. Renders nothing until at least one is set. */
export function TrustBar({ className = "" }: { className?: string }) {
  const q = useQuery({ queryKey: ["site-settings"], queryFn: fetchTrustSettings, staleTime: 10 * 60_000 });
  const items = q.data ? trustItems(q.data) : [];
  if (!items.length) return null;
  return <TrustBarView items={items} className={className} />;
}

export function TrustBarView({ items, className = "" }: { items: TrustItem[]; className?: string }) {
  return (
    <section className={`es-trust-bar ${className}`} aria-label="Why buy from the workshop" data-testid="trust-bar">
      <ul>
        {items.map((it) => {
          const Icon = ICONS[it.key as keyof typeof ICONS] ?? BadgeCheck;
          const body = (
            <>
              <Icon className="size-4 shrink-0 text-esred" aria-hidden="true" />
              <span>
                <span className="es-trust-label">{it.label}</span>
                <span className="es-trust-value">{it.value}</span>
              </span>
            </>
          );
          return (
            <li key={it.key}>
              {it.href ? (
                <a href={it.href} target="_blank" rel="noopener noreferrer" className="es-trust-item">
                  {body}
                </a>
              ) : (
                <span className="es-trust-item">{body}</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
