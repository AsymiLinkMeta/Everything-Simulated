import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Cookie, X } from "lucide-react";
import { onConsentOpen, openConsentSettings, readConsent, writeConsent, type ConsentRecord } from "@/lib/es/consent";

const fmt = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso.slice(0, 10);
  }
};

/**
 * Cookie consent banner. Non-modal (the page stays usable), shown until the visitor makes
 * a choice, and reopened from "Cookie settings" in the footer or the privacy policy.
 * Accept and Reject carry equal weight. The only optional cookies are the ambassador
 * referral cookies (es_ref, es_vid); see src/lib/es/referral.ts for what each choice does.
 */
export function ConsentBanner() {
  const [record, setRecord] = useState<ConsentRecord | null>(() => readConsent());
  const [open, setOpen] = useState(() => readConsent() === null);
  const [reopened, setReopened] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(
    () =>
      onConsentOpen(() => {
        returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setRecord(readConsent());
        setReopened(true);
        setOpen(true);
      }),
    [],
  );

  // Reopened on request: move focus into the banner so keyboard and screen-reader users land on it.
  useEffect(() => {
    if (open && reopened) titleRef.current?.focus();
  }, [open, reopened]);

  const close = useCallback(() => {
    setOpen(false);
    setReopened(false);
    const back = returnTo.current;
    returnTo.current = null;
    if (back && document.contains(back)) back.focus();
  }, []);

  const choose = (referral: boolean) => {
    setRecord(writeConsent(referral));
    close();
  };

  useEffect(() => {
    if (!open || !record) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, record, close]);

  if (!open) return null;

  return (
    <section className="es-consent" role="region" aria-labelledby={titleId} aria-describedby={descId} data-testid="cookie-consent">
      <div className="es-consent-inner">
        <div className="es-consent-copy">
          <h2 id={titleId} ref={titleRef} tabIndex={-1} className="es-consent-title">
            <Cookie aria-hidden="true" className="es-consent-icon" />
            Cookies on Everything Simulated
          </h2>
          <p id={descId}>
            We only use what keeps the site working: your cart, your sign-in and this choice. With your OK we also set two
            first-party cookies when you arrive through an ambassador's link or QR code, so they're credited for your quote or order
            for 90 days. No advertising or analytics cookies.{" "}
            <Link to="/privacy#cookies" className="es-consent-link">
              Cookie details
            </Link>
          </p>
          {record ? (
            <p className="es-consent-status" data-testid="cookie-consent-status">
              Your current choice: <strong>{record.referral ? "Accepted" : "Rejected"}</strong> on {fmt(record.ts)}. You can change it
              at any time.
            </p>
          ) : null}
        </div>
        <div className="es-consent-actions">
          <button type="button" className="es-consent-btn" onClick={() => choose(false)} aria-pressed={record ? !record.referral : undefined}>
            Reject cookies
          </button>
          <button type="button" className="es-consent-btn" onClick={() => choose(true)} aria-pressed={record ? record.referral : undefined}>
            Accept cookies
          </button>
        </div>
        {record ? (
          <button type="button" className="es-consent-close" onClick={close} aria-label="Close cookie settings and keep my choice">
            <X aria-hidden="true" className="size-4" />
          </button>
        ) : null}
      </div>
    </section>
  );
}

/** Footer / policy link that reopens the banner. */
export function CookieSettingsButton({ className, children = "Cookie settings" }: { className?: string; children?: React.ReactNode }) {
  return (
    <button
      type="button"
      className={className ?? "es-cookie-settings"}
      onClick={openConsentSettings}
      data-testid="cookie-settings"
    >
      {children}
    </button>
  );
}
