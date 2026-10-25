import { STAGE_IMAGES } from "@/lib/es/stage-images";
import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/es/seo";
import { PageHero } from "@/components/es/section-page";
import { CookieSettingsButton } from "@/components/es/consent-banner";
import { BRAND } from "@/lib/es/content";

export const Route = createFileRoute("/_site/privacy")({
  head: () =>
    pageHead({
      title: "Privacy Policy | Everything Simulated",
      description: "How Everything Simulated collects, stores and protects your account, quote and booking data under Australian privacy requirements.",
      path: "/privacy",
    }),
  component: Privacy,
});

const LAST_UPDATED = "25 October 2026";
const LAST_UPDATED_ISO = "2026-10-25";

type Row = { name: string; kind: string; purpose: string; duration: string; when: string };

const STORAGE: Row[] = [
  {
    name: "es_ref",
    kind: "First-party cookie",
    purpose: "Holds the ambassador's code so they can be credited (and paid commission) for a quote or order you place.",
    duration: "90 days",
    when: "Optional. Only after you accept cookies, when you arrive through an ambassador's link or QR code.",
  },
  {
    name: "es_vid",
    kind: "First-party cookie",
    purpose: "A random identifier so one visitor counts as one ambassador link visit per day. We store only a salted one-way hash of it.",
    duration: "90 days",
    when: "Optional. Only after you accept cookies, alongside es_ref.",
  },
  {
    name: "es-consent",
    kind: "Local storage",
    purpose: "Remembers your cookie choice (accept or reject), its version and the date you made it.",
    duration: "Until you change it or clear site data",
    when: "Strictly necessary. Set when you make a choice.",
  },
  {
    name: "sb-…-auth-token",
    kind: "Local storage",
    purpose: "Keeps you signed in to your account (Supabase authentication session).",
    duration: "Until you sign out",
    when: "Strictly necessary. Signed-in users only.",
  },
  {
    name: "es-cart-v2",
    kind: "Local storage",
    purpose: "Your cart, postcode and any code you type at checkout.",
    duration: "Until you clear the cart or site data",
    when: "Strictly necessary. When you add to the cart.",
  },
  {
    name: "es-ref-session",
    kind: "Session storage",
    purpose: "If you arrive through an ambassador's link without accepting cookies, holds only the ambassador's code (no identifier) so an order in the same visit is credited.",
    duration: "Until you close the tab",
    when: "Only for the current visit.",
  },
  {
    name: "es-track-email, es-pw-recovery",
    kind: "Session storage",
    purpose: "Lets you track an order you just placed, and finish a password reset.",
    duration: "Until you close the tab",
    when: "Strictly necessary. Only when you use those features.",
  },
];

function H2({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mt-10 scroll-mt-24 text-base font-medium text-paper">
      {children}
    </h2>
  );
}

function Privacy() {
  const tel = BRAND.phone.replace(/\s/g, "");
  return (
    <article>
      <PageHero kicker="Legal" title="Privacy Policy" lead="How we handle your data — account, quote and booking information stays with the workshop." image={STAGE_IMAGES["/privacy"]} />
      <div className="es-body mx-auto max-w-3xl text-sm leading-relaxed text-muted">
        <p className="text-paper" data-testid="privacy-updated">
          Last updated: <time dateTime={LAST_UPDATED_ISO}>{LAST_UPDATED}</time>
        </p>
        <p className="mt-4">
          This policy explains how {BRAND.name} ({BRAND.region}) manages personal information in line with the Privacy Act 1988
          (Cth) and the Australian Privacy Principles (APPs). It is our APP 1 privacy policy, and together with the notices at the
          point we collect information it tells you what APP 5 requires: who we are and how to contact us, what we collect and why,
          what happens if you don't provide it, who we may disclose it to, and how to access, correct or complain about it.
        </p>

        <H2>What we collect and why</H2>
        <p className="mt-2">
          Everything Simulated collects account email, saved quotes, bookings and chat messages so we can spec, build and deliver
          your simulator. When you order we also collect your name, phone number, delivery address and postcode to price freight,
          arrange delivery and contact you about the build. We do not sell personal information. Data is stored in
          Australia-capable infrastructure and used only to fulfil an order, a demo, or support. If you don't give us these
          details we may not be able to quote, build or deliver.
        </p>
        <p className="mt-4">
          Compatibility checks run locally in the browser until you save a quote. Chat with the build expert is stored against your
          account.
        </p>

        <H2>Who we share it with</H2>
        <p className="mt-2">
          We share personal information only with the service providers that host this website and its database, process card
          payments and send our emails, and only as far as they need to do that for us. Some of these providers may store or process
          data outside Australia. Ambassadors see counts and order references for referrals credited to them, never your contact
          details.
        </p>

        <H2 id="cookies">Cookies and similar storage</H2>
        <p className="mt-2">
          We don't use advertising or analytics cookies. The only optional cookies are the two ambassador referral cookies below,
          and we only set them after you choose <strong className="text-paper">Accept cookies</strong>. Everything else is strictly
          necessary for the site to work, so it doesn't need consent. Nothing here is shared with advertisers.
        </p>
        <div className="mt-4 overflow-x-auto rounded-md border border-line" role="region" aria-label="Cookies and storage we use" tabIndex={0}>
          <table className="w-full min-w-[640px] border-collapse text-left text-xs" data-testid="cookie-table">
            <caption className="sr-only">Cookies and browser storage used by everythingsimulated.com.au</caption>
            <thead className="bg-raised text-paper">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Name</th>
                <th scope="col" className="px-3 py-2 font-medium">Type</th>
                <th scope="col" className="px-3 py-2 font-medium">Purpose</th>
                <th scope="col" className="px-3 py-2 font-medium">Lasts</th>
                <th scope="col" className="px-3 py-2 font-medium">When it's set</th>
              </tr>
            </thead>
            <tbody>
              {STORAGE.map((r) => (
                <tr key={r.name} className="border-t border-line align-top">
                  <th scope="row" className="px-3 py-2 font-normal text-paper">
                    <code>{r.name}</code>
                  </th>
                  <td className="px-3 py-2">{r.kind}</td>
                  <td className="px-3 py-2">{r.purpose}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.duration}</td>
                  <td className="px-3 py-2">{r.when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4">
          <strong className="text-paper">Changing your mind.</strong> You can accept or withdraw consent at any time from{" "}
          <CookieSettingsButton className="es-cookie-settings text-paper underline underline-offset-2">Cookie settings</CookieSettingsButton>{" "}
          (also in the footer of every page). Withdrawing removes <code>es_ref</code> and <code>es_vid</code> straight away. You can
          also clear cookies and site data in your browser.
        </p>

        <H2>Ambassador referrals</H2>
        <p className="mt-2">
          When you arrive through an ambassador's link or QR code and have accepted cookies, <code>es_ref</code> holds the
          ambassador's code and <code>es_vid</code> is a random identifier. They last for the referral window shown on the
          ambassador's page (90 days) and are only used to credit the ambassador when you request a quote or place an order. We
          count a visit once per day, keyed by a salted one-way hash of that identifier; we don't store your IP address or browser
          details. The last ambassador link you used is the one credited.
        </p>
        <p className="mt-4">
          If you reject cookies or haven't chosen yet, we don't set either cookie and don't record the visit. The ambassador's code
          is kept in your browser for this visit only, so a quote or order you place before closing the tab is still credited. You
          can always type an ambassador code at checkout instead.
        </p>

        <H2>Young ambassadors</H2>
        <p className="mt-2">
          Ambassador profiles for drivers under 18 are only published, and commission only paid, after a parent or guardian has
          approved. We keep the guardian's name, email and the date of approval for that purpose.
        </p>

        <H2>Access, correction and complaints</H2>
        <p className="mt-2">
          Contact <a className="text-paper underline underline-offset-2" href={`mailto:${BRAND.email}`}>{BRAND.email}</a> or{" "}
          <a className="text-paper underline underline-offset-2" href={`tel:${tel}`}>{BRAND.phone}</a> to access, correct or
          delete your records, or to make a privacy complaint. We'll acknowledge it and aim to respond within 30 days.
        </p>
        <p className="mt-4">
          If you're not satisfied with our response, you can complain to the Office of the Australian Information Commissioner
          (OAIC):{" "}
          <a className="text-paper underline underline-offset-2" href="https://www.oaic.gov.au/privacy/privacy-complaints" target="_blank" rel="noopener noreferrer">
            oaic.gov.au/privacy/privacy-complaints
          </a>{" "}
          or 1300 363 992.
        </p>

        <H2>Changes to this policy</H2>
        <p className="mt-2">We'll update the date at the top of this page whenever we change this policy.</p>
      </div>
    </article>
  );
}
