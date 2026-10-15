import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/es/seo";
import { PageHero } from "@/components/es/section-page";

export const Route = createFileRoute("/_site/privacy")({
  head: () =>
    pageHead({
      title: "Privacy Policy | Everything Simulated",
      description: "How Everything Simulated collects, stores and protects your account, quote and booking data under Australian privacy requirements.",
      path: "/privacy",
    }),
  component: Privacy,
});

function Privacy() {
  return (
    <article>
      <PageHero kicker="Legal" title="Privacy Policy" lead="How we handle your data — account, quote and booking information stays with the workshop." image="/rigs/showroom.jpg" />
      <div className="es-body mx-auto max-w-2xl text-sm leading-relaxed text-muted">
        <p>Everything Simulated collects account email, saved quotes, bookings and chat messages so we can spec, build and deliver your simulator. We do not sell personal information. Data is stored in Australia-capable infrastructure and used only to fulfil an order, a demo, or support.</p>
        <p className="mt-4">Compatibility checks run locally in the browser until you save a quote. Chat with the build expert is stored against your account. Contact hello@everythingsimulated.com.au to access or delete your records.</p>
        <h2 className="mt-8 text-base font-medium text-paper">Ambassador referral cookies</h2>
        <p className="mt-2">
          When you arrive through an ambassador's link or QR code we set two first-party cookies: <code>es_ref</code> holds the
          ambassador's code and <code>es_vid</code> is a random identifier. They last for the referral window shown on the
          ambassador's page (90 days) and are only used to credit the ambassador when you request a quote or place an order. We
          count a visit once per day, keyed by a salted one-way hash of that identifier; we don't store your IP address or browser
          details, and nothing is shared with advertisers. The last ambassador link you used is the one credited. Clearing your
          cookies removes both.
        </p>
        <h2 className="mt-8 text-base font-medium text-paper">Young ambassadors</h2>
        <p className="mt-2">
          Ambassador profiles for drivers under 18 are only published, and commission only paid, after a parent or guardian has
          approved. We keep the guardian's name, email and the date of approval for that purpose.
        </p>
      </div>
    </article>
  );
}
