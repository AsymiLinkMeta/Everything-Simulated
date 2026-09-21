import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { JsonLd } from "@/components/es/bits";
import { PageHero } from "@/components/es/section-page";
import {
  AMBASSADOR_PROFILE_FIELDS,
  AMBASSADOR_SERIES,
  AMBASSADORS,
  type AmbassadorSeries,
} from "@/lib/es/ambassadors";
import { breadcrumbLd, pageHead } from "@/lib/es/seo";

export const Route = createFileRoute("/_site/drivers")({
  head: () =>
    pageHead({
      title: "Ambassadors | Everything Simulated",
      description:
        "Everything Simulated ambassadors — kart through Carrera Cup. Public racing cards with series, age band and social links. Named only when the agreement is current.",
      path: "/ambassadors",
    }),
  component: AmbassadorsPage,
});

export function AmbassadorsPage() {
  const [series, setSeries] = useState<AmbassadorSeries | "all">("all");
  const published = useMemo(
    () =>
      AMBASSADORS.filter((a) => a.published).filter((a) =>
        series === "all" ? true : a.series.includes(series),
      ),
    [series],
  );

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
        lead="Kart through Carrera Cup. Public cards only — name, series, this season, an age band if they want it, and links out to their own socials. We do not invent a grid."
        image="/rigs/haptic.jpg"
        tone="race"
      />

      <div className="es-body">
        <div className="es-series-filter" role="tablist" aria-label="Series">
          <button
            type="button"
            className={`es-series-chip${series === "all" ? " is-on" : ""}`}
            onClick={() => setSeries("all")}
          >
            All
          </button>
          {AMBASSADOR_SERIES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`es-series-chip${series === s.id ? " is-on" : ""}`}
              onClick={() => setSeries(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>

        <ul className="es-ambassador-grid">
          {published.map((a) => (
            <li key={a.slug} className="es-ambassador-card">
              <p className="es-kicker">{a.program ?? a.series[0]}</p>
              <h2>{a.name}</h2>
              <p className="es-ambassador-meta">
                {a.series.join(" · ")}
                {a.ageBand ? ` · ${a.ageBand}` : ""}
                {a.base ? ` · ${a.base}` : ""}
              </p>
              {a.season ? <p className="es-ambassador-season">{a.season}</p> : null}
              <p>{a.bio}</p>
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
                <p className="es-ambassador-socials is-empty">Socials land when the driver sends them.</p>
              )}
            </li>
          ))}
          {published.length === 0 ? (
            <li className="es-ambassador-card is-open">
              <p className="es-kicker">Open</p>
              <h2>No published card in this series yet.</h2>
              <p>Named ambassadors go up after the agreement is current. Filter back to All, or nominate a driver.</p>
            </li>
          ) : null}
        </ul>

        <section className="es-ambassador-pathway">
          <p className="es-kicker">Pathway</p>
          <h2 className="es-display mt-2 text-4xl">The grid we will fill.</h2>
          <p className="mt-3 max-w-2xl text-sm text-muted">
            From the sprint weekends through national tin-top. Seats stay open until a name is real.
          </p>
          <ul className="es-expedition mt-8" data-tone="race">
            {AMBASSADOR_SERIES.map((s, i) => (
              <li key={s.id}>
                <div className="es-expedition-tile">
                  <span className="es-expedition-idx">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <p className="es-expedition-label">{s.label}</p>
                    <p>{s.note}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="es-ambassador-form-preview">
          <p className="es-kicker">Their card</p>
          <h2 className="es-display mt-2 text-4xl">What they can put on a profile.</h2>
          <p className="mt-3 max-w-2xl text-sm text-muted">
            A racing card, not a Facebook wall. Age is a band they choose to show. Date of birth, school, phone and street stay off the site.
            Under 18: guardian on the login, staff publish.
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
