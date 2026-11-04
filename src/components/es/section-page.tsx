import type { ReactNode } from "react";
import { SiteImage } from "@/components/es/site-image";
import { Link } from "@tanstack/react-router";
import { BRAND } from "@/lib/es/catalog";
import type { PlatformLink } from "@/lib/es/platforms";

export type ImageCard = {
  to: string;
  image: string;
  kicker: string;
  title: string;
  hint: string;
};

export function SectionLinks({
  links,
  current,
  tone = "race",
}: {
  links: PlatformLink[];
  current?: string;
  tone?: "race" | "adventure";
}) {
  return (
    <nav className="es-pit-tabs" data-tone={tone} aria-label="Section">
      {links.map((l) => (
        <Link key={l.to} to={l.to} className={`es-pit-tab${current === l.to ? " is-current" : ""}`}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

export function ToolCards({
  links,
  tone = "race",
}: {
  links: PlatformLink[];
  tone?: "race" | "adventure";
}) {
  return (
    <ul className="es-expedition" data-tone={tone}>
      {links.map((l, i) => (
        <li key={l.to}>
          <Link to={l.to} className="es-expedition-tile">
            <span className="es-expedition-idx">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <p className="es-expedition-label">{l.label}</p>
              <p>{l.hint}</p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ImageCards({
  cards,
  columns = 3,
}: {
  cards: ImageCard[];
  columns?: 2 | 3 | 4;
}) {
  const cols = columns === 4 ? "is-4" : columns === 2 ? "is-2" : "is-3";
  return (
    <ul className={`es-tile-grid ${cols}`}>
      {cards.map((card) => (
        <li key={card.to}>
          <Link to={card.to} className="es-tile">
            <div className="es-tile-frame">
              <SiteImage src={card.image} sizes="(min-width: 1024px) 33vw, 100vw" />
            </div>
            <div className="es-tile-copy">
              <p className="es-kicker">{card.kicker}</p>
              <h3>{card.title}</h3>
              <p>{card.hint}</p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function PageIntro({
  kicker,
  title,
  lead,
}: {
  kicker: string;
  title: string;
  lead: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="es-kicker es-kicker-telemetry">{kicker}</p>
      <h1 className="es-display mt-3 text-5xl sm:text-6xl">{title}</h1>
      <p className="mt-5 max-w-2xl text-base leading-7 text-muted">{lead}</p>
    </div>
  );
}

/**
 * Page header. With `image` it's a studio "stage" (render on the right, copy bottom-left);
 * without, a compact text header. Tool and policy pages use the text header so the content
 * starts above the fold.
 */
export function PageHero({
  kicker,
  title,
  lead,
  image,
  children,
}: {
  kicker: string;
  title: string;
  lead?: string;
  image?: string;
  /** @deprecated kept for call-site compatibility; the redesign uses one tone. */
  tone?: "race" | "adventure";
  children?: ReactNode;
}) {
  const copy = (
    <>
      <p className="ds-eyebrow">{kicker}</p>
      <h1 className="ds-h1">{title}</h1>
      {lead ? <p className="ds-lead mt-5">{lead}</p> : null}
      {children ? <div className="mt-7">{children}</div> : null}
    </>
  );
  if (!image) {
    return (
      <header className="ds-pagehead">
        <div className="ds-container">{copy}</div>
      </header>
    );
  }
  return (
    <header className="ds-stage">
      <div className="ds-stage-art">
        <SiteImage src={image} alt="" priority width={1800} height={1013} />
      </div>
      <div className="ds-container">{copy}</div>
    </header>
  );
}

export function PageBand({
  children,
  ink = false,
}: {
  children: ReactNode;
  ink?: boolean;
}) {
  return (
    <section className={`es-page-band${ink ? " is-ink" : ""}`}>
      <div className="es-body">{children}</div>
    </section>
  );
}

export function CtaStrip({
  title,
  lead,
  children,
}: {
  title: string;
  lead: string;
  children?: ReactNode;
}) {
  return (
    <div className="es-cta-strip">
      <p>
        <strong>{title}</strong>
        {lead}
      </p>
      <div className="es-cta-actions">{children}</div>
    </div>
  );
}

export function PhoneStrip({
  title = "Talk to the workshop.",
  lead = "Gold Coast demos, build and delivery questions, and event enquiries.",
}: {
  title?: string;
  lead?: string;
}) {
  return (
    <CtaStrip title={title} lead={lead}>
      <a href={`tel:${BRAND.phone.replace(/\s/g, "")}`} className="es-btn">
        {BRAND.phone}
      </a>
      <Link to="/contact" className="es-btn es-btn-paper">
        Enquire
      </Link>
    </CtaStrip>
  );
}

export function MediaSplit({
  image,
  kicker,
  title,
  lead,
  flip = false,
  children,
}: {
  image: string;
  kicker: string;
  title: string;
  lead: string;
  flip?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={`es-media-split${flip ? " is-flip" : ""}`}>
      <div className="es-media-split-frame">
        <SiteImage src={image} sizes="(min-width: 1024px) 50vw, 100vw" />
      </div>
      <div className="es-media-split-copy">
        <p className="es-kicker">{kicker}</p>
        <h2>{title}</h2>
        <p className="text-sm leading-6 text-muted">{lead}</p>
        {children}
      </div>
    </div>
  );
}
