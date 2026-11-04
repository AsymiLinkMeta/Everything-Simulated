import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { PrebuildPhoto } from "./site-image";
import { EsFallback } from "./product-photo";
import { Money } from "./bits";
import type { PrebuildWithComponents } from "@/lib/es/prebuilds";

/** Prebuild card: studio photo, name (the card's link), one line, three specs, price. */
export function RigCard({ prebuild: p, priority }: { prebuild: PrebuildWithComponents; priority?: boolean }) {
  const specs = Object.values(p.specs ?? {}).filter(Boolean).slice(0, 3);
  return (
    <article className="ds-card ds-rig-card" data-testid="rig-card">
      <div className="ds-card-media">
        <PrebuildPhoto
          prebuild={p}
          alt={p.name}
          priority={priority}
          sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
          placeholder={<EsFallback alt={p.name} fallbackKey="fallback:prebuild" label={p.kicker || "Prebuilt rig"} />}
        />
      </div>
      <div className="ds-card-body">
        {p.kicker ? <p className="ds-eyebrow">{p.kicker}</p> : null}
        <h3 className="ds-h2">
          <Link to="/prebuilds/$slug" params={{ slug: p.slug }} className="ds-stretch">
            {p.name}
          </Link>
        </h3>
        {p.blurb ? <p className="ds-muted">{p.blurb}</p> : null}
        {specs.length ? (
          <ul className="ds-specs" aria-label="Key specs">
            {specs.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        ) : null}
        <div className="ds-card-foot">
          <p className="ds-price">
            {p.purchasable ? (
              <>
                {p.price_source === "parts" ? <small>From </small> : null}
                <Money cents={p.effective_price_ex_gst} gst />
              </>
            ) : (
              "Enquire for price"
            )}
          </p>
          <span className="ds-link" aria-hidden="true">
            View <ArrowRight className="size-4" />
          </span>
        </div>
      </div>
    </article>
  );
}

export function RigCardSkeleton() {
  return (
    <div className="ds-card ds-rig-card" aria-hidden="true">
      <div className="ds-card-media ds-skeleton" />
      <div className="ds-card-body">
        <div className="ds-skeleton" style={{ height: "1rem", width: "30%" }} />
        <div className="ds-skeleton" style={{ height: "2.25rem", width: "70%" }} />
        <div className="ds-skeleton" style={{ height: "1rem", width: "90%" }} />
      </div>
    </div>
  );
}
