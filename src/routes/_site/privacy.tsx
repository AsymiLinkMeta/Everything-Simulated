import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/es/seo";

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
    <article className="mx-auto max-w-2xl px-4 py-16 text-sm leading-relaxed text-muted">
      <h1 className="text-3xl font-medium text-paper">Privacy</h1>
      <p className="mt-6">
        Everything Simulated collects account email, saved quotes, bookings and chat messages so we
        can spec, build and deliver your simulator. We do not sell personal information. Data is
        stored in Australia-capable infrastructure and used only to fulfil an order, a demo, or
        support.
      </p>
      <p className="mt-4">
        Compatibility checks run locally in the browser until you save a quote. Chat with the build
        expert is stored against your account. Contact hello@everythingsimulated.com.au to access or
        delete your records.
      </p>
    </article>
  );
}
