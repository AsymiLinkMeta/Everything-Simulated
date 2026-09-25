import { createFileRoute, Link } from "@tanstack/react-router";
import { JsonLd, Money } from "@/components/es/bits";
import { OrderRigButton } from "@/components/es/order-rig";
import { CtaStrip, PageHero } from "@/components/es/section-page";
import {
  AMBASSADOR_PROFILE_FIELDS,
  AMBASSADORS,
  ambassadorLink,
  ambassadorProfilePath,
  crateForAmbassador,
  specsForAmbassador,
} from "@/lib/es/ambassadors";
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

export function AmbassadorsPage() {
  const published = AMBASSADORS.filter((a) => a.published);

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
        <ul className="es-ambassador-grid">
          {published.map((a) => {
            const crate = crateForAmbassador(a);
            const specs = specsForAmbassador(a).slice(0, 4);
            return (
              <li key={a.slug} className="es-ambassador-card">
                <Link to={ambassadorProfilePath(a.slug)} className="es-ambassador-photo">
                  {a.photo ? <img src={a.photo} alt="" /> : <span className="es-kicker">Photo pending</span>}
                </Link>
                <p className="es-kicker">{a.motorsport || "Ambassador"}</p>
                <h2>
                  <Link to={ambassadorProfilePath(a.slug)}>{a.name}</Link>
                </h2>
                <p className="es-ambassador-meta">
                  {[a.series, a.className, a.teamStatus, a.ageBand, a.base].filter(Boolean).join(" · ")}
                </p>
                <p className="es-ambassador-bio">{a.bio}</p>
                {a.social && Object.values(a.social).some(Boolean) ? (
                  <p className="es-ambassador-socials">
                    {a.social.instagram ? (
                      <a href={a.social.instagram} target="_blank" rel="noopener noreferrer">
                        Instagram
                      </a>
                    ) : null}
                    {a.social.tiktok ? (
                      <a href={a.social.tiktok} target="_blank" rel="noopener noreferrer">
                        TikTok
                      </a>
                    ) : null}
                    {a.social.youtube ? (
                      <a href={a.social.youtube} target="_blank" rel="noopener noreferrer">
                        YouTube
                      </a>
                    ) : null}
                    {a.social.facebook ? (
                      <a href={a.social.facebook} target="_blank" rel="noopener noreferrer">
                        Facebook
                      </a>
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
          })}
        </ul>

        <section className="es-ambassador-form-preview">
          <p className="es-kicker">Their card</p>
          <h2 className="es-display mt-2 text-4xl">Driver Profiles & Rig Specs</h2>

          <ul className="es-profile-fields">
            {AMBASSADOR_PROFILE_FIELDS.map((f) => (
              <li key={f.label}>
                <strong>{f.label}</strong>
                <span>{f.note}</span>
              </li>
            ))}
          </ul>
        </section>

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
