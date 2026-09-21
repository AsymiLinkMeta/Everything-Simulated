import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { PlatformLink } from "@/lib/es/platforms";

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

export function PageHero({
  kicker,
  title,
  lead,
  image,
  tone = "race",
  children,
}: {
  kicker: string;
  title: string;
  lead: string;
  image?: string;
  tone?: "race" | "adventure";
  children?: ReactNode;
}) {
  return (
    <header className={`es-stage es-stage-${tone}`}>
      {image ? <img src={image} alt="" className="es-stage-img" /> : null}
      <div className="es-stage-veil" />
      <div className="es-stage-copy">
        <div className="es-lights" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        <p className="es-kicker es-kicker-telemetry">{kicker}</p>
        <h1>{title}</h1>
        <p className="es-lead">{lead}</p>
        {children}
      </div>
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
        <img src={image} alt="" />
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
