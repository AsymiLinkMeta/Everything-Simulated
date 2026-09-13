import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { BackButton, JsonLd } from "@/components/es/bits";
import { guideBySlug, GUIDES } from "@/lib/es/catalog";
import { articleLd, breadcrumbLd, pageHead } from "@/lib/es/seo";
import { PageHero } from "@/components/es/section-page";

export const Route = createFileRoute("/_site/guides/$slug")({
  loader: ({ params }) => {
    const guide = guideBySlug(params.slug);
    if (!guide) throw notFound();
    return guide;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    return pageHead({
      title: `${loaderData.title} | Everything Simulated`,
      description: loaderData.description,
      path: `/guides/${loaderData.slug}`,
      type: "article",
    });
  },
  component: GuidePage,
});

function GuidePage() {
  const guide = Route.useLoaderData();
  return (
    <article>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Guides", path: "/guides" }, { name: guide.title, path: `/guides/${guide.slug}` }])} />
      <JsonLd data={articleLd(guide)} />
      <PageHero kicker="Guide" title={guide.title} lead={guide.description} image="/rigs/haptic.jpg" />
      <div className="es-body mx-auto max-w-2xl">
        <BackButton />
        <div className="space-y-5 text-base leading-relaxed">
          {guide.body.map((p) => (
            <p key={p} className="text-muted">{p}</p>
          ))}
        </div>
        <div className="mt-12 border-t border-line pt-8">
          <p className="es-kicker es-kicker-telemetry mb-4">Keep reading</p>
          <ul className="space-y-2">
            {GUIDES.filter((g) => g.slug !== guide.slug).map((g) => (
              <li key={g.slug}>
                <Link to="/guides/$slug" params={{ slug: g.slug }} className="text-sm text-paper">{g.title}</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  );
}
