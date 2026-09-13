import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/es/seo";
import { PageHero } from "@/components/es/section-page";

export const Route = createFileRoute("/_site/privacy")({
  head: () =>
    pageHead({
      title: "Privacy policy | Everything Simulated",
      description: "How Everything Simulated handles account, quote and booking data in Australia.",
      path: "/privacy",
    }),
  component: Privacy,
});

function Privacy() {
  return (
    <article>
      <PageHero kicker="Legal" title="Privacy." lead="Account, quote and booking data stays with the workshop." image="/rigs/showroom.jpg" />
      <div className="es-body mx-auto max-w-2xl text-sm leading-relaxed text-muted">
        <p>Everything Simulated collects account email, saved quotes, bookings and chat messages so we can spec, build and deliver your simulator. We do not sell personal information. Data is stored in Australia-capable infrastructure and used only to fulfil an order, a demo, or support.</p>
        <p className="mt-4">Compatibility checks run locally in the browser until you save a quote. Chat with the build expert is stored against your account. Contact hello@everythingsimulated.com.au to access or delete your records.</p>
      </div>
    </article>
  );
}
