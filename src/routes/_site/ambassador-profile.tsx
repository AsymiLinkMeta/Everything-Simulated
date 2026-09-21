import { createFileRoute, Link } from "@tanstack/react-router";
import { useParams } from "react-router-dom";
import { JsonLd, Money } from "@/components/es/bits";
import { OrderRigButton } from "@/components/es/order-rig";
import { CtaStrip, PageHero } from "@/components/es/section-page";
import {
  ambassadorBySlug,
  ambassadorLink,
  crateForAmbassador,
  specsForAmbassador,
} from "@/lib/es/ambassadors";
import { breadcrumbLd, pageHead } from "@/lib/es/seo";

export const Route = createFileRoute("/_site/ambassador-profile")({
  head: () =>
    pageHead({
      title: "Ambassador | Everything Simulated",
      description: "Ambassador profile, rig specs and Order this rig.",
      path: "/ambassadors",
    }),
  component: AmbassadorProfile,
});

export function AmbassadorProfile() {
  const { slug } = useParams();
  const ambassador = ambassadorBySlug(slug || "");

  if (!ambassador) {
    return (
      <div className="es-body">
        <p className="es-kicker">Ambassadors</p>
        <h1 className="es-display mt-2 text-5xl">Card not published.</h1>
        <p className="mt-4 max-w-xl text-muted">That seat is not live yet, or the link is wrong.</p>
        <Link to="/ambassadors" className="es-btn mt-8 inline-flex">
          All ambassadors
        </Link>
      </div>
    );
  }

  const crate = crateForAmbassador(ambassador);
  const specs = specsForAmbassador(ambassador);

  return (
    <div>
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Ambassadors", path: "/ambassadors" },
          { name: ambassador.name, path: `/ambassadors/${ambassador.slug}` },
        ])}
      />
      <PageHero
        kicker={[ambassador.motorsport, ambassador.series, ambassador.className].filter(Boolean).join(" · ") || "Ambassador"}
        title={ambassador.name}
        lead={ambassador.bio}
        image={ambassador.photo || crate?.image || "/rigs/haptic.jpg"}
        tone="race"
      >
        <div className="mt-8 flex flex-wrap gap-3">
          {crate ? <OrderRigButton ambassador={ambassador} /> : null}
          <Link to={ambassadorLink(ambassador.code)} className="es-btn es-btn-paper">
            Code {ambassador.code}
          </Link>
        </div>
      </PageHero>

      <div className="es-body">
        <div className="es-media-split">
          <div className="es-media-split-frame">
            <img src={crate?.image || ambassador.photo || "/rigs/haptic.jpg"} alt="" />
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
              <p className="text-sm leading-6 text-muted">Staff attach a live prebuild before Order this rig goes live.</p>
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
                <OrderRigButton ambassador={ambassador} checkout>
                  Checkout this crate
                </OrderRigButton>
              </div>
            ) : null}
          </div>
        </div>

        <CtaStrip
          title={`${ambassador.base || "Gold Coast"} · ${ambassador.code}`}
          lead="Using their link or code attributes the order to this ambassador. The price does not change."
        >
          <Link to="/ambassadors" className="es-btn es-btn-paper">
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
