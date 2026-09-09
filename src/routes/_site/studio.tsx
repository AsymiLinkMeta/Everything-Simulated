import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/es/catalog";
import { pageHead } from "@/lib/es/seo";

export const Route = createFileRoute("/_site/studio")({
  head: () =>
    pageHead({
      title: "Gold Coast sim racing showroom | Try before you buy",
      description:
        "Book a Gold Coast studio session. Sit in Starter, Haptic and Motion rigs, set pedal spacing, then we crate your build Australia-wide.",
      path: "/studio",
    }),
  component: Studio,
});

function Studio() {
  return (
    <div>
      <section className="relative isolate min-h-[70dvh] overflow-hidden">
        <img src="/rigs/showroom.jpg" alt="Everything Simulated Gold Coast showroom" className="absolute inset-0 size-full object-cover" />
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/rigs/WNI7y.jpg')" }}
        />
        <div className="relative mx-auto flex min-h-[70dvh] w-full min-w-0 max-w-6xl flex-col justify-end overflow-x-hidden px-4 pb-16">
          <p className="es-kicker">Showroom</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-medium md:text-5xl">Sit in the rig before it ships.</h1>
        </div>
      </section>
      <div className="mx-auto grid w-full min-w-0 max-w-6xl gap-10 overflow-x-hidden px-4 py-16 md:grid-cols-2">
        <div className="space-y-4">
          <p className="text-muted">
            The workshop is on the Gold Coast. Book a demo for Starter, Haptic or Motion. We set
            wheel height and pedal spacing on the chassis you are actually buying.
          </p>
          <p className="text-sm text-muted">
            {BRAND.region} · {BRAND.phone} · {BRAND.email}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild>
              <Link to="/app/book">Book a demo</Link>
            </Button>
            <Button variant="outline" asChild>
              <a href={`tel:${BRAND.phone.replace(/\s/g, "")}`}>Call the workshop</a>
            </Button>
          </div>
        </div>
        <ul className="es-card space-y-4 p-6 text-sm text-muted">
          <li>Weekday and Saturday slots.</li>
          <li>Juniors welcome with a parent — we cap torque at 12Nm unless a coach asks otherwise.</li>
          <li>If you already own triples or a PC, bring photos. We strip those lines from the quote.</li>
          <li>After the session, save a quote in the customer app and we start the build job.</li>
        </ul>
      </div>
    </div>
  );
}
