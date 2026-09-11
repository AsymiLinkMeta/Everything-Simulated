import { createFileRoute, Link } from "@tanstack/react-router";
import { JsonLd } from "@/components/es/bits";
import { PageIntro } from "@/components/es/section-page";
import { breadcrumbLd, pageHead } from "@/lib/es/seo";

export const Route = createFileRoute("/_site/drivers")({
  head: () =>
    pageHead({
      title: "Sponsored drivers | Everything Simulated",
      description:
        "Workshop-supported and sponsored drivers on Everything Simulated racing simulators. Junior pathway and Gold Coast studio.",
      path: "/drivers",
    }),
  component: DriversPage,
});

function DriversPage() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl overflow-x-hidden px-4 py-16">
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Drivers", path: "/drivers" },
        ])}
      />
      <PageIntro
        kicker="People"
        title="Sponsored drivers."
        lead="The workshop backs drivers on the same crates we ship. Juniors on the karting pathway, and drivers who train with us between race weekends. Names and liveries are listed as agreements land — we do not invent a grid."
      />
      <ul className="mt-10 grid gap-4 sm:grid-cols-2">
        <li className="es-card p-5">
          <p className="es-kicker">Pathway</p>
          <h2 className="mt-2 text-xl font-medium">Junior drivers</h2>
          <p className="mt-2 text-sm text-muted">
            Adjustable seat, 12Nm unless a coach asks otherwise, Gold Coast demo for pedal spacing. See Training → Driver.
          </p>
        </li>
        <li className="es-card p-5">
          <p className="es-kicker">Workshop</p>
          <h2 className="mt-2 text-xl font-medium">Supported programs</h2>
          <p className="mt-2 text-sm text-muted">
            If you already have a driver, team or series agreement, send it to the inbox. We will add the profile here when it is real.
          </p>
        </li>
      </ul>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/training/driver" className="es-btn">
          Driver training
        </Link>
        <Link to="/contact" className="es-btn es-btn-paper">
          Nominate a driver
        </Link>
      </div>
    </div>
  );
}
