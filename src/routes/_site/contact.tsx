import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { BRAND } from "@/lib/es/catalog";
import { createTicket } from "@/lib/es/inbox";
import { contactPageLd, pageHead } from "@/lib/es/seo";
import { JsonLd } from "@/components/es/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHero } from "@/components/es/section-page";

export const Route = createFileRoute("/_site/contact")({
  head: () =>
    pageHead({
      title: "Contact Everything Simulated | Gold Coast sim racing workshop",
      description: `Call ${BRAND.contactName} on ${BRAND.phone} or message the workshop. Gold Coast try-before-you-buy demos and Australia-wide crate freight.`,
      path: "/contact",
    }),
  component: Contact,
});

function Contact() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      await createTicket({
        subject: `Website enquiry from ${name.trim() || email}`,
        body: message,
        email,
        name,
        kind: "contact",
      });
      setSent(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <JsonLd data={contactPageLd()} />
      <PageHero
        kicker="Workshop"
        title="Talk to the people who bolt it together."
        lead={`Call ${BRAND.contactName} for a Gold Coast demo, or send a message — it lands in the staff inbox.`}
        image="/rigs/showroom.jpg"
      />
      <div className="es-body mx-auto max-w-3xl">
        <div className="grid gap-4 sm:grid-cols-2">
          <a href={`tel:${BRAND.phone.replace(/\s/g, "")}`} className="es-card p-5">
            <p className="es-kicker">Phone · {BRAND.contactName}</p>
            <p className="mt-2 text-xl">{BRAND.phone}</p>
          </a>
          <div className="es-card p-5">
            <p className="es-kicker">Portal</p>
            <p className="mt-2 text-xl">Staff inbox</p>
          </div>
        </div>
        {sent ? (
          <div className="es-card mt-8 space-y-3 p-6">
            <p className="font-medium">Received. The workshop will reply in the app.</p>
            <Button asChild>
              <Link to="/login">Sign in to view messages</Link>
            </Button>
          </div>
        ) : (
          <form className="es-card mt-8 space-y-4 p-6" onSubmit={onSubmit}>
            <label className="block">
              <span className="text-sm text-muted">Name *</span>
              <Input required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </label>
            <label className="block">
              <span className="text-sm text-muted">Email *</span>
              <Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </label>
            <label className="block">
              <span className="text-sm text-muted">Message *</span>
              <textarea required rows={5} value={message} onChange={(e) => setMessage(e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-paper placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent" />
            </label>
            <Button type="submit" disabled={pending}>{pending ? "Sending…" : "Send to workshop"}</Button>
          </form>
        )}
        <p className="mt-6 text-muted">{BRAND.region}. {BRAND.shipping}.</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild><Link to="/studio">Book a demo</Link></Button>
          <Button variant="outline" asChild><Link to="/compatibility">Start a build</Link></Button>
        </div>
      </div>
    </div>
  );
}
