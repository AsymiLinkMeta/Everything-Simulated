import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { BackButton, JsonLd } from "@/components/es/bits";
import { guideBySlug, GUIDES } from "@/lib/es/catalog";
import { articleLd, breadcrumbLd, pageHead } from "@/lib/es/seo";

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
    <article className="mx-auto max-w-2xl px-4 py-16">
      <BackButton />
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Guides", path: "/guides" },
          { name: guide.title, path: `/guides/${guide.slug}` },
        ])}
      />
      <JsonLd data={articleLd(guide)} />
      <p className="es-kicker">Guide</p>
      <h1 className="mt-3 text-4xl font-medium">{guide.title}</h1>
      <p className="mt-4 text-muted">{guide.description}</p>
      <div className="mt-10 space-y-5 text-base leading-relaxed text-paper">
        {guide.body.map((p) => (
          <p key={p} className="text-muted">
            {p}
          </p>
        ))}
      </div>
      <div className="mt-12 border-t border-line pt-8">
        <p className="es-kicker mb-4">Keep reading</p>
        <ul className="space-y-2">
          {GUIDES.filter((g) => g.slug !== guide.slug).map((g) => (
            <li key={g.slug}>
              <Link to="/guides/$slug" params={{ slug: g.slug }} className="text-sm text-paper">
                {g.title}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
