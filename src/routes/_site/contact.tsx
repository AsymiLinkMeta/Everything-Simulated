import { STAGE_IMAGES } from "@/lib/es/stage-images";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "@/lib/toast";
import { BRAND } from "@/lib/es/catalog";
import { createTicket } from "@/lib/es/inbox";
import { contactPageLd, pageHead } from "@/lib/es/seo";
import { JsonLd } from "@/components/es/bits";
import { Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHero } from "@/components/es/section-page";

export const Route = createFileRoute("/_site/contact")({
  head: () =>
    pageHead({
      title: "Contact Everything Simulated | Gold Coast Simulator Workshop",
      description: `Call ${BRAND.phone} or send an enquiry. Book a hands-on demo at our Gold Coast showroom or discuss a custom build. Australia-wide delivery available.`,
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
        title="Contact the Workshop"
        lead="Call us directly for a showroom demo, or send an enquiry below — it goes straight to the team."
        image={STAGE_IMAGES["/contact"]}
      />
      <div className="es-body mx-auto max-w-3xl">
        <div className="grid gap-3 sm:grid-cols-2">
          <a href={`tel:${BRAND.phone.replace(/\s/g, "")}`} className="es-contact-action" data-testid="contact-call">
            <Phone className="size-5 text-esred" aria-hidden="true" />
            <span>
              <span className="es-kicker block">Call the workshop</span>
              <span className="mt-1 block text-lg">{BRAND.phone}</span>
            </span>
          </a>
          <a href={`mailto:${BRAND.email}`} className="es-contact-action" data-testid="contact-email">
            <Mail className="size-5 text-esred" aria-hidden="true" />
            <span>
              <span className="es-kicker block">Email us</span>
              <span className="mt-1 block break-all text-lg">{BRAND.email}</span>
            </span>
          </a>
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
              <textarea required rows={5} value={message} onChange={(e) => setMessage(e.target.value)} className="es-input mt-1" />
            </label>
            <Button type="submit" disabled={pending}>{pending ? "Sending…" : "Send to workshop"}</Button>
          </form>
        )}
        <p className="mt-6 text-muted">{BRAND.region}. {BRAND.shipping}.</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button variant="outline" asChild><Link to="/studio">Book a showroom demo</Link></Button>
          <Link to="/compatibility" className="text-sm text-muted underline-offset-4 hover:text-paper hover:underline sm:ml-2">
            Or start a build online
          </Link>
        </div>
      </div>
    </div>
  );
}
