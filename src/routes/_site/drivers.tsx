import { createFileRoute, Link } from "@tanstack/react-router";
import { JsonLd } from "@/components/es/bits";
import { PageHero } from "@/components/es/section-page";
import { breadcrumbLd, pageHead } from "@/lib/es/seo";

export const Route = createFileRoute("/_site/drivers")({
  head: () =>
    pageHead({
      title: "Sponsored drivers | Everything Simulated",
      description:
        "Workshop-supported drivers on Everything Simulated racing simulators — including Carter Cosgrove Racing. Junior pathway and Gold Coast studio.",
      path: "/drivers",
    }),
  component: DriversPage,
});

function DriversPage() {
  return (
    <div>
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Drivers", path: "/drivers" },
        ])}
      />
      <PageHero
        kicker="People"
        title="Drivers the workshop backs."
        lead="The same crates we ship are the ones drivers train on. Juniors on the karting pathway, and named programs we have already stood next to. We do not invent a grid."
        image="/rigs/haptic.jpg"
        tone="race"
      />
      <div className="es-body">
        <ul className="es-expedition" data-tone="race">
          <li>
            <div className="es-expedition-tile">
              <span className="es-expedition-idx">01</span>
              <div>
                <p className="es-kicker">Named</p>
                <p className="es-expedition-label">Carter Cosgrove Racing</p>
                <p>A driver program the workshop has publicly stood with. Profile detail lands here as the agreement is current.</p>
              </div>
            </div>
          </li>
          <li>
            <div className="es-expedition-tile">
              <span className="es-expedition-idx">02</span>
              <div>
                <p className="es-kicker">Pathway</p>
                <p className="es-expedition-label">Junior drivers</p>
                <p>Adjustable seat, 12Nm unless a coach asks otherwise, four-screen coaching layout, Gold Coast demo for pedal spacing.</p>
              </div>
            </div>
          </li>
          <li>
            <div className="es-expedition-tile">
              <span className="es-expedition-idx">03</span>
              <div>
                <p className="es-kicker">Workshop</p>
                <p className="es-expedition-label">Supported programs</p>
                <p>If you already have a driver, team or series agreement, send it to the inbox. We add the profile when it is real.</p>
              </div>
            </div>
          </li>
        </ul>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/training/driver" className="es-btn">
            Driver training
          </Link>
          <Link to="/contact" className="es-btn es-btn-paper">
            Nominate a driver
          </Link>
        </div>
      </div>
    </div>
  );
}
