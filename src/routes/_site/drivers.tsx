import { createFileRoute, Link } from "@tanstack/react-router";
import { JsonLd } from "@/components/es/bits";
import { PageHero } from "@/components/es/section-page";
import { AMBASSADOR_PROFILE_FIELDS, AMBASSADORS, ambassadorLink } from "@/lib/es/ambassadors";
import { breadcrumbLd, pageHead } from "@/lib/es/seo";

export const Route = createFileRoute("/_site/drivers")({
  head: () =>
    pageHead({
      title: "Ambassadors | Everything Simulated",
      description:
        "Everything Simulated ambassadors. Each card is photo, name, bio, motorsport, series and class — written by the driver. Referral codes attribute checkout to the ambassador.",
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
        title="Drivers the workshop stands with."
        lead="Photo, name, bio, the motorsport they race, the series and class they are in. They type it. A code on the card attributes a checkout to them — it is not a discount."
        image="/rigs/haptic.jpg"
        tone="race"
      />

      <div className="es-body">
        <ul className="es-ambassador-grid">
          {published.map((a) => (
            <li key={a.slug} className="es-ambassador-card">
              {a.photo ? (
                <div className="es-ambassador-photo">
                  <img src={a.photo} alt="" />
                </div>
              ) : (
                <p className="es-kicker">Photo pending</p>
              )}
              <h2>{a.name}</h2>
              <p className="es-ambassador-meta">
                {[a.motorsport, a.series, a.className, a.teamStatus, a.ageBand, a.base]
                  .filter(Boolean)
                  .join(" · ")}
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
              <p className="es-ambassador-code">
                Code <strong>{a.code}</strong>
                <Link to={ambassadorLink(a.code)}>Use this link at checkout</Link>
              </p>
            </li>
          ))}
        </ul>

        <section className="es-ambassador-form-preview">
          <p className="es-kicker">Their card</p>
          <h2 className="es-display mt-2 text-4xl">They fill it. We do not preset the grid.</h2>
          <p className="mt-3 max-w-2xl text-sm text-muted">
            Motorsport, series and class are blank fields. Carrera Cup, a state sprint cup, a kart class, privateer or works — they write the words.
            The workshop issues the code. Staff still publish the card.
          </p>
          <ul className="es-profile-fields">
            {AMBASSADOR_PROFILE_FIELDS.map((f) => (
              <li key={f.label}>
                <strong>{f.label}</strong>
                <span>{f.note}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="es-ambassador-form-preview">
          <p className="es-kicker">Referrals</p>
          <h2 className="es-display mt-2 text-4xl">The code attributes the crate. It does not discount it.</h2>
          <p className="mt-3 max-w-2xl text-sm text-muted">
            A buyer uses the ambassador link or types the code at checkout. The order notes record which ambassador it came through.
            Commission is settled by the workshop from that record — not taken off the customer's ticket.
          </p>
        </section>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/contact" className="es-btn">
            Nominate an ambassador
          </Link>
          <Link to="/training/driver" className="es-btn es-btn-paper">
            Driver training
          </Link>
        </div>
      </div>
    </div>
  );
}
