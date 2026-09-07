import { createFileRoute, Link } from "@tanstack/react-router";
import { BRAND } from "@/lib/es/catalog";
import { pageHead } from "@/lib/es/seo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_site/contact")({
  head: () =>
    pageHead({
      title: "Contact Everything Simulated | Gold Coast sim racing workshop",
      description: `Call ${BRAND.phone} or email ${BRAND.email}. Gold Coast showroom demos and Australia-wide crate freight.`,
      path: "/contact",
    }),
  component: Contact,
});

function Contact() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <p className="es-kicker">Workshop</p>
      <h1 className="mt-3 text-4xl font-medium">Talk to the people who bolt it together</h1>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <a href={`tel:${BRAND.phone.replace(/\s/g, "")}`} className="es-card p-5">
          <p className="es-kicker">Phone</p>
          <p className="mt-2 text-xl">{BRAND.phone}</p>
        </a>
        <a href={`mailto:${BRAND.email}`} className="es-card p-5">
          <p className="es-kicker">Email</p>
          <p className="mt-2 text-xl">{BRAND.email}</p>
        </a>
      </div>
      <p className="mt-6 text-muted">{BRAND.region}. {BRAND.shipping}.</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button asChild>
          <Link to="/app/book">Book a demo</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/compatibility">Start a build</Link>
        </Button>
      </div>
    </div>
  );
}
