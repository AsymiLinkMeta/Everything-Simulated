import { PrebuildPhoto } from "@/components/es/site-image";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { JsonLd, Money } from "@/components/es/bits";
import { OrderRigButton } from "@/components/es/order-rig";
import { CtaStrip, PageHero } from "@/components/es/section-page";
import {
  fetchAmbassadors,
  ambassadorLink,
  ambassadorProfilePath,
  crateForAmbassador,
  specsForAmbassador,
  fetchTiers,
  tierLabel,
} from "@/lib/es/ambassadors";
import type { Ambassador, AmbassadorTier, TierRow } from "@/lib/es/ambassadors";
import { LoadError } from "@/components/es/bits";
import { breadcrumbLd, pageHead } from "@/lib/es/seo";
import { fetchPublishedPrebuilds } from "@/lib/es/prebuilds";

export const Route = createFileRoute("/_site/drivers")({
  head: () =>
    pageHead({
      title: "Ambassador Drivers & Sponsored Teams | Everything Simulated",
      description:
        "Meet the drivers and teams behind Everything Simulated. Each ambassador profile features their motorsport, series, class and the exact simulator they train on — available to order.",
      path: "/ambassadors",
    }),
  component: AmbassadorsPage,
});

/** Groups in the order of ambassador_tiers.sort_order; unknown tiers go last. */
function groupByTier(ambassadors: Ambassador[], tiers: TierRow[]): { tier: AmbassadorTier; label: string; items: Ambassador[] }[] {
  const order = [...tiers.map((t) => t.key), ...ambassadors.map((a) => a.tier)].filter((k, i, all) => all.indexOf(k) === i);
  return order
    .map((tier) => ({ tier, label: tierLabel(tiers, tier), items: ambassadors.filter((a) => a.tier === tier) }))
    .filter((g) => g.items.length > 0);
}

export function AmbassadorsPage() {
  const { data: ambassadors, isPending, isError, refetch } = useQuery({ queryKey: ["ambassadors"], queryFn: fetchAmbassadors });
  const tiers = useQuery({ queryKey: ["ambassador-tiers"], queryFn: fetchTiers });
  // crateForAmbassador reads the prebuild cache; load it so the rig links resolve.
  useQuery({ queryKey: ["prebuilds"], queryFn: fetchPublishedPrebuilds });

  if (isPending) {
    return (
      <div>
        <PageHero
          kicker="People · Ambassadors"
          title="Our Ambassador Drivers"
          lead="The drivers and teams we stand behind. Each profile shows their motorsport, series and the simulator they train on."
          image="/rigs/haptic.jpg"
          tone="race"
        />
        <div className="es-body">
          <div className="h-96 animate-pulse rounded-2xl bg-raised" />
        </div>
      </div>
    );
  }

  const published = ambassadors ?? [];
  const groups = groupByTier(published, tiers.data ?? []);

  return (
    <div>
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Ambassadors", path: "/ambassadors" },
        ])}
      />
      <PageHero
        kicker="People · Ambassadors"
        title="Our Ambassador Drivers"
        lead="The drivers and teams we stand behind. Each profile shows their motorsport, series and the simulator they train on. Order their exact rig configuration — the ambassador code attributes the build, not a discount."
        image="/rigs/haptic.jpg"
        tone="race"
      />

      <div className="es-body">
        {isError ? (
          <LoadError what="ambassadors" onRetry={() => void refetch()} />
        ) : published.length === 0 ? (
          <p className="py-12 text-center text-muted">Ambassador profiles will appear here once published.</p>
        ) : (
          <div className="space-y-16">
            {groups.map((g) => (
              <section key={g.tier}>
                <div className="es-tier-header">
                  <span className={`es-tier-badge es-tier-badge--${g.tier}`}>{g.label}</span>
                  <span className="text-sm text-muted">{g.items.length} {g.items.length === 1 ? "member" : "members"}</span>
                </div>
                <ul className="es-ambassador-grid">
                  {g.items.map((a) => (
                    <AmbassadorCard key={a.slug} a={a} label={g.label} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        <CtaStrip title="Ambassador Referral Program" lead="Ambassador codes attribute the order to the driver. Commission is managed by the workshop — it is not a customer discount.">
          <Link to="/contact" className="es-btn">
            Nominate an ambassador
          </Link>
          <Link to="/training/driver" className="es-btn es-btn-paper">
            Driver training
          </Link>
        </CtaStrip>
      </div>
    </div>
  );
}

function AmbassadorCard({ a, label }: { a: Ambassador; label: string }) {
  const crate = crateForAmbassador(a);
  const specs = specsForAmbassador(a).slice(0, 4);

  return (
    <li className="es-ambassador-card">
      <Link to={ambassadorProfilePath(a.slug)} className="es-ambassador-photo">
        {a.photo ? <img src={a.photo} alt={a.name} loading="lazy" /> : <span className="es-kicker">Photo pending</span>}
      </Link>
      <div className="es-ambassador-card-head">
        <div>
          <p className="es-kicker">{a.motorsport || "Ambassador"}</p>
          <h2>
            <Link to={ambassadorProfilePath(a.slug)}>{a.name}</Link>
          </h2>
        </div>
        <span className={`es-tier-pill es-tier-pill--${a.tier}`}>{label}</span>
      </div>
      <p className="es-ambassador-meta">
        {[a.series, a.className, a.teamStatus, a.ageBand, a.base].filter(Boolean).join(" · ")}
      </p>
      <p className="es-ambassador-bio">{a.bio}</p>
      {a.social && Object.values(a.social).some(Boolean) ? (
        <p className="es-ambassador-socials">
          {a.social.instagram ? (
            <a href={a.social.instagram} target="_blank" rel="noopener noreferrer">Instagram</a>
          ) : null}
          {a.social.tiktok ? (
            <a href={a.social.tiktok} target="_blank" rel="noopener noreferrer">TikTok</a>
          ) : null}
          {a.social.youtube ? (
            <a href={a.social.youtube} target="_blank" rel="noopener noreferrer">YouTube</a>
          ) : null}
          {a.social.facebook ? (
            <a href={a.social.facebook} target="_blank" rel="noopener noreferrer">Facebook</a>
          ) : null}
        </p>
      ) : null}

      {crate ? (
        <div className="es-ambassador-rig">
          <div className="es-ambassador-rig-head">
            <PrebuildPhoto prebuild={crate} fallback="/rigs/haptic.jpg" alt="" />
            <p>
              <span className="es-kicker">Their rig</span>
              <strong>{crate.name}</strong>
              <Money cents={crate.priceExGst} gst />
            </p>
          </div>
          {specs.length ? (
            <dl className="es-spec-table" style={{ marginTop: "0.9rem" }}>
              {specs.map((row) => (
                <div key={`${row.label}-${row.value}`}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          <div className="es-ambassador-actions">
            <OrderRigButton ambassador={a} />
            <Link to={ambassadorProfilePath(a.slug)} className="es-btn es-btn-paper">
              Full profile
            </Link>
          </div>
        </div>
      ) : (
        <p className="es-ambassador-code">Ask the workshop about this driver's rig.</p>
      )}
      <p className="es-ambassador-code">
        Code <strong>{a.code}</strong>
        <Link to={ambassadorLink(a.code, a.slug)}>Shop with this code</Link>
      </p>
    </li>
  );
}
