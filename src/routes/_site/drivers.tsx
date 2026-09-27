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
  TIER_LABELS,
} from "@/lib/es/ambassadors";
import type { Ambassador, AmbassadorTier } from "@/lib/es/ambassadors";
import { breadcrumbLd, pageHead } from "@/lib/es/seo";

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

const TIER_ORDER: AmbassadorTier[] = ["fully_sponsored", "sponsored_driver", "sponsored_customer"];

function groupByTier(ambassadors: Ambassador[]): { tier: AmbassadorTier; label: string; items: Ambassador[] }[] {
  const groups: { tier: AmbassadorTier; label: string; items: Ambassador[] }[] = [];
  for (const tier of TIER_ORDER) {
    const items = ambassadors.filter((a) => a.tier === tier);
    if (items.length) groups.push({ tier, label: TIER_LABELS[tier], items });
  }
  return groups;
}

export function AmbassadorsPage() {
  const { data: ambassadors, isPending } = useQuery({ queryKey: ["ambassadors"], queryFn: fetchAmbassadors });

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
  const groups = groupByTier(published);

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
        {published.length === 0 ? (
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
                    <AmbassadorCard key={a.slug} a={a} />
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

function AmbassadorCard({ a }: { a: Ambassador }) {
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
        <span className={`es-tier-pill es-tier-pill--${a.tier}`}>{TIER_LABELS[a.tier]}</span>
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
      ) : (
        <p className="es-ambassador-socials is-empty">Socials land when they send the links.</p>
      )}

      {crate ? (
        <div className="es-ambassador-rig">
          <div className="es-ambassador-rig-head">
            <img src={crate.image} alt="" />
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
        <p className="es-ambassador-code">Rig pending — staff attach a prebuild.</p>
      )}
      <p className="es-ambassador-code">
        Code <strong>{a.code}</strong>
        <Link to={ambassadorLink(a.code)}>Use this link at checkout</Link>
      </p>
    </li>
  );
}
