import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { BackButton, JsonLd, PackageCard } from "@/components/es/bits";
import { CITIES, cityBySlug } from "@/lib/es/catalog";
import { livePackages } from "@/lib/es/prebuilds";
import { breadcrumbLd, faqLd, FAQS, localBusinessLd, pageHead } from "@/lib/es/seo";
import { PageHero } from "@/components/es/section-page";

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
    <div>
      <JsonLd data={localBusinessLd(city.name)} />
      <JsonLd data={faqLd(FAQS)} />
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Australia", path: "/au" }, { name: city.name, path: `/au/${city.slug}` }])} />
      <PageHero
        kicker={`${city.state} · Australia-wide`}
        title={`Racing simulators in ${city.name}.`}
        lead={city.note}
        image="/rigs/showroom.jpg"
      />
      <div className="es-body">
        <BackButton />
        <p className="max-w-2xl text-sm text-muted">Every system is still assembled and QA’d on the Gold Coast. Workshop photos before the crate is sealed.</p>
        <div className="mt-10 grid grid-cols-2 gap-6 md:grid-cols-3">
          {livePackages().map((pack) => (
            <PackageCard key={pack.slug} pack={pack} />
          ))}
        </div>
        <div className="mt-12">
          <p className="es-kicker es-kicker-telemetry mb-3">Other cities</p>
          <div className="flex flex-wrap gap-2">
            {CITIES.filter((c) => c.slug !== city.slug).map((c) => (
              <Link key={c.slug} to="/au/$city" params={{ city: c.slug }} className="border border-line px-3 py-2 text-sm text-muted hover:text-paper">
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
