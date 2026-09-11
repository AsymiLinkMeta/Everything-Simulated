import { Link } from "@tanstack/react-router";
import type { PlatformLink } from "@/lib/es/platforms";

export function SectionLinks({
  links,
  current,
}: {
  links: PlatformLink[];
  current?: string;
}) {
  return (
    <nav className="mb-10 flex flex-wrap gap-2" aria-label="Section">
      {links.map((l) => (
        <Link
          key={l.to}
          to={l.to}
          className={`rounded-md border px-3 py-2 text-sm ${current === l.to ? "border-esred bg-raised text-paper" : "border-line text-muted hover:border-paper hover:text-paper"}`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

export function ToolCards({ links }: { links: PlatformLink[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {links.map((l) => (
        <li key={l.to}>
          <Link to={l.to} className="es-card block h-full p-5 hover:bg-raised">
            <p className="font-medium">{l.label}</p>
            <p className="mt-2 text-sm text-muted">{l.hint}</p>
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
    <div className="max-w-2xl">
      <p className="es-kicker">{kicker}</p>
      <h1 className="mt-3 text-4xl font-medium">{title}</h1>
      <p className="mt-4 text-muted">{lead}</p>
    </div>
  );
}
