import { createFileRoute, Link } from "@tanstack/react-router";
import { JsonLd } from "@/components/es/bits";
import { PageHero, SectionLinks } from "@/components/es/section-page";
import { TRAINING_PAGES } from "@/lib/es/platforms";
import { breadcrumbLd, pageHead } from "@/lib/es/seo";

export const Route = createFileRoute("/_site/training/")({
  head: () =>
    pageHead({
      title: "Simulator training | Driver, industrial, aviation | Everything Simulated",
      description: "Motorsport, driver, industrial and vehicle training programs on Gold Coast assembled simulators. Group sessions for professional and amateur drivers at the planned warehouse.",
      path: "/training",
    }),
  component: TrainingHub,
});

function TrainingHub() {
  return (
    <div>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Training", path: "/training" }])} />
      <PageHero
        kicker="Training · programs"
        title="Hours before the real thing."
        lead="Motorsport and juniors already run on four-screen racing crates. Group days for professional and amateur drivers sit on the warehouse floor — enquire. Truck, side-kart and excavator work is capacity."
        image="/rigs/starter.jpg"
      />
      <div className="es-chapter-row">
        <Link to="/training/driver" className="es-chapter">
          <img src="/rigs/haptic.jpg" alt="" />
          <div className="es-chapter-veil" />
          <div className="es-chapter-copy">
            <span className="es-chapter-idx">01</span>
            <p className="es-kicker es-kicker-telemetry">Driver</p>
            <h2>Kart. Road. Motorsport.</h2>
            <p>Four-screen coaching on the racing crates.</p>
          </div>
        </Link>
        <Link to="/events" className="es-chapter">
          <img src="/rigs/showroom.jpg" alt="" />
          <div className="es-chapter-veil" />
          <div className="es-chapter-copy">
            <span className="es-chapter-idx">02</span>
            <p className="es-kicker es-kicker-telemetry">Groups</p>
            <h2>Pro and amateur days</h2>
            <p>Warehouse group training plus catering. Enquire, not a calendar.</p>
          </div>
        </Link>
        <Link to="/training/industrial" className="es-chapter">
          <img src="/rigs/starter.jpg" alt="" />
          <div className="es-chapter-veil" />
          <div className="es-chapter-copy">
            <span className="es-chapter-idx">03</span>
            <p className="es-kicker es-kicker-telemetry">Industrial</p>
            <h2>Plant and heavy vehicle</h2>
            <p>Truck, side-kart, excavator — enquire, not a shop.</p>
          </div>
        </Link>
      </div>
      <div className="es-body">
        <SectionLinks links={TRAINING_PAGES} current="/training" />
      </div>
    </div>
  );
}
