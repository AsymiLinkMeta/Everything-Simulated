import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { JsonLd, PackageCard } from "@/components/es/bits";
import { CITIES, cityBySlug, PACKAGES } from "@/lib/es/catalog";
import { breadcrumbLd, faqLd, FAQS, localBusinessLd, pageHead } from "@/lib/es/seo";

export const Route = createFileRoute("/_site/au/$city")({
  loader: ({ params }) => {
    const city = cityBySlug(params.city);
    if (!city) throw notFound();
    return city;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    return pageHead({
      title: `Sim racing simulator ${loaderData.name} ${loaderData.state} | Everything Simulated`,
      description: `Buy a Gold Coast built racing simulator delivered to ${loaderData.name}. ${loaderData.note} Starter, Haptic and Motion packages with Simagic and SIMRIG.`,
      path: `/au/${loaderData.slug}`,
    });
  },
  component: CityPage,
});

function CityPage() {
  const city = Route.useLoaderData();
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <JsonLd data={localBusinessLd()} />
      <JsonLd data={faqLd(FAQS)} />
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Australia", path: "/au" },
          { name: city.name, path: `/au/${city.slug}` },
        ])}
      />
      <p className="es-kicker">
        {city.state} · Australia-wide
      </p>
      <h1 className="mt-3 text-4xl font-medium">Racing simulators in {city.name}</h1>
      <p className="mt-4 max-w-2xl text-muted">{city.note}</p>
      <p className="mt-3 max-w-2xl text-sm text-muted">
        Every system is still assembled and QA’d on the Gold Coast. You get workshop photos before
        the crate is sealed. Compatibility is checked in the build app before deposit.
      </p>
      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {PACKAGES.map((pack) => (
          <PackageCard key={pack.slug} pack={pack} />
        ))}
      </div>
      <div className="mt-12 es-card p-6">
        <h2 className="text-xl font-medium">Delivery to {city.name}</h2>
        <p className="mt-3 text-sm text-muted">
          Starter and Haptic travel as a crate plus monitor cartons. Motion adds a dedicated SR2
          crate. Optional on-site calibration is booked on a run — not overnight — except SEQ.
        </p>
        <Link to="/studio" className="mt-4 inline-flex min-h-11 items-center text-sm text-paper">
          Prefer to demo on the Gold Coast first
        </Link>
      </div>
      <div className="mt-10">
        <p className="es-kicker mb-3">Other cities</p>
        <div className="flex flex-wrap gap-2">
          {CITIES.filter((c) => c.slug !== city.slug).map((c) => (
            <Link
              key={c.slug}
              to="/au/$city"
              params={{ city: c.slug }}
              className="rounded-md border border-line px-3 py-2 text-sm text-muted hover:text-paper"
            >
              {c.name}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
