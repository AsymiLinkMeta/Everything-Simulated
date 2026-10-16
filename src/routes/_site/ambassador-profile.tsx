import { PrebuildPhoto, SiteImage } from "@/components/es/site-image";
import { createFileRoute, Link, applyHeadPayload } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { JsonLd, Money } from "@/components/es/bits";
import { OrderRigButton } from "@/components/es/order-rig";
import { QrCode } from "@/components/es/qr-code";
import { CtaStrip, PageHero } from "@/components/es/section-page";
import {
  fetchAmbassadors,
  getCachedAmbassadorBySlug,
  ambassadorLink,
  ambassadorShareUrl,
  crateForAmbassador,
  specsForAmbassador,
  fetchTiers,
  tierLabel,
} from "@/lib/es/ambassadors";
import { LoadError } from "@/components/es/bits";
import { BRAND } from "@/lib/es/content";
import { ORIGIN, breadcrumbLd, pageHead } from "@/lib/es/seo";
import { fetchPublishedPrebuilds } from "@/lib/es/prebuilds";

export const Route = createFileRoute("/_site/ambassador-profile")({
  head: () =>
    pageHead({
      title: "Ambassador Profile | Everything Simulated",
      description: "View this ambassador's motorsport profile, simulator specs and order the exact rig they train on.",
      path: "/ambassadors",
    }),
  component: AmbassadorProfile,
});

export function AmbassadorProfile() {
  const { slug } = useParams();
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["ambassadors"], queryFn: fetchAmbassadors });
  const tiers = useQuery({ queryKey: ["ambassador-tiers"], queryFn: fetchTiers });
  // crateForAmbassador reads the prebuild cache; load it so the rig links resolve.
  useQuery({ queryKey: ["prebuilds"], queryFn: fetchPublishedPrebuilds });
  const [showQr, setShowQr] = useState(false);

  const ambassador = data
    ? data.find((a) => a.slug === (slug || ""))
    : getCachedAmbassadorBySlug(slug || "");

  useEffect(() => {
    if (ambassador) {
      applyHeadPayload(
        pageHead({
          title: `${ambassador.name} | Ambassador | Everything Simulated`,
          description: ambassador.bio.slice(0, 160),
          path: `/ambassadors/${ambassador.slug}`,
          image: ambassador.photo,
        }),
      );
    }
    // Re-apply head tags only when the profile identity changes, not on every refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ambassador?.slug]);

  if (isPending) {
    return (
      <div className="es-body">
        <div className="h-96 animate-pulse rounded-2xl bg-raised" />
      </div>
    );
  }

  if (isError && !ambassador) {
    return (
      <div className="es-body">
        <LoadError what="this profile" onRetry={() => void refetch()} />
      </div>
    );
  }

  if (!ambassador) {
    return (
      <div className="es-body">
        <p className="es-kicker">Ambassadors</p>
        <h1 className="es-display mt-2 text-5xl">Profile Not Published</h1>
        <p className="mt-4 max-w-xl text-muted">This ambassador profile is not live yet, or the link may be incorrect.</p>
        <Link to="/ambassadors" className="es-btn mt-8 inline-flex">
          All ambassadors
        </Link>
      </div>
    );
  }

  const crate = crateForAmbassador(ambassador);
  const specs = specsForAmbassador(ambassador);
  const shareUrl = ambassadorShareUrl(ambassador);
  const pageUrl = `${ORIGIN}/ambassadors/${ambassador.slug}`;
  const sameAs = Object.values(ambassador.social ?? {}).filter((v): v is string => typeof v === "string" && /^https:\/\//.test(v));

  return (
    <div>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ProfilePage",
          url: pageUrl,
          mainEntity: {
            "@type": "Person",
            name: ambassador.name,
            url: pageUrl,
            description: ambassador.bio.slice(0, 300) || undefined,
            image: ambassador.photo || undefined,
            sameAs: sameAs.length ? sameAs : undefined,
            affiliation: { "@type": "Organization", name: BRAND.name, url: ORIGIN },
          },
        }}
      />
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Ambassadors", path: "/ambassadors" },
          { name: ambassador.name, path: `/ambassadors/${ambassador.slug}` },
        ])}
      />
      <PageHero
        kicker={[ambassador.teamStatus, ambassador.motorsport, ambassador.series, ambassador.className].filter(Boolean).join(" · ") || "Ambassador"}
        title={ambassador.name}
        lead={ambassador.bio || undefined}
        image={ambassador.photo || crate?.image || "/rigs/haptic.jpg"}
        tone="race"
      >
        <div className="mt-4">
          <span className={`es-tier-pill es-tier-pill--${ambassador.tier}`}>{tierLabel(tiers.data, ambassador.tier)}</span>
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          {crate || ambassador.crate ? <OrderRigButton ambassador={ambassador} /> : null}
          <Link to={ambassadorLink(ambassador.code, ambassador.slug)} className="es-btn es-btn-ghost">
            Use code {ambassador.code}
          </Link>
          <button
            type="button"
            className="es-btn es-btn-ghost"
            onClick={() => setShowQr(!showQr)}
          >
            {showQr ? "Hide QR" : "Show QR Code"}
          </button>
        </div>
      </PageHero>

      {showQr && (
        <div className="es-body" style={{ textAlign: "center", paddingBottom: 0 }}>
          <div className="es-qr-panel">
            <QrCode url={shareUrl} size={200} filename={`es-ambassador-${ambassador.slug}`} label={`QR code for ${ambassador.name}`} />
            <p className="mt-3 text-sm text-muted">
              Scan to open this profile. Orders placed within 90 days are credited to {ambassador.name}.
            </p>
            <p className="mt-1 text-xs text-muted break-all" style={{ maxWidth: 320, margin: "4px auto 0" }}>
              {shareUrl}
            </p>
          </div>
        </div>
      )}

      <div className="es-body">
        <div className="es-media-split">
          <div className="es-media-split-frame">
            {crate ? <PrebuildPhoto prebuild={crate} fallback={ambassador.photo || "/rigs/haptic.jpg"} alt="" /> : <SiteImage src={ambassador.photo || "/rigs/haptic.jpg"} alt="" />}
          </div>
          <div className="es-media-split-copy">
            <p className="es-kicker">Their rig</p>
            <h2>{crate ? crate.name : "Rig pending"}</h2>
            {crate ? (
              <>
                <p className="text-sm leading-6 text-muted">{ambassador.rigNote || crate.blurb}</p>
                <p className="text-2xl font-medium text-paper">
                  <Money cents={crate.priceExGst} gst />
                </p>
              </>
            ) : (
              <p className="text-sm leading-6 text-muted">Ask the workshop about this driver's rig.</p>
            )}
            {specs.length ? (
              <dl className="es-spec-table">
                {specs.map((row) => (
                  <div key={`${row.label}-${row.value}`}>
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {crate ? (
              <div className="es-ambassador-actions">
                <OrderRigButton ambassador={ambassador} />
              </div>
            ) : null}
          </div>
        </div>

        <CtaStrip
          title={[ambassador.base, `Code ${ambassador.code}`].filter(Boolean).join(" · ")}
          lead="Using their link or code attributes the order to this ambassador. The price does not change."
        >
          <Link to="/ambassadors" className="es-btn es-btn-ghost">
            All ambassadors
          </Link>
          <Link to="/studio" className="es-btn es-btn-ghost">
            Book a studio demo
          </Link>
        </CtaStrip>
      </div>
    </div>
  );
}
