import { Link, Outlet } from "@tanstack/react-router";
import { Phone } from "lucide-react";
import { BRAND, CITIES, GUIDES, PACKAGES } from "@/lib/es/catalog";
import { AuthSlot, Logo } from "./bits";

const NAV = [
  { to: "/builds", label: "Builds" },
  { to: "/shop", label: "Shop" },
  { to: "/compatibility", label: "Checker" },
  { to: "/studio", label: "Studio" },
  { to: "/guides", label: "Guides" },
  { to: "/au", label: "Australia" },
] as const;

export function SiteShell({ children }: { children?: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-ink text-paper">
      <header className="relative sticky top-0 z-40 border-b border-line bg-ink/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Logo />
          <nav className="ml-auto hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="inline-flex min-h-11 items-center px-3 text-sm text-muted hover:text-paper"
                activeProps={{ className: "text-paper" }}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <a
            href={`tel:${BRAND.phone.replace(/\s/g, "")}`}
            className="hidden min-h-11 items-center gap-2 px-2 text-sm text-muted hover:text-paper lg:inline-flex"
          >
            <Phone className="size-4" />
            {BRAND.phone}
          </a>
          <Link
            to="/app"
            className="hidden min-h-11 items-center px-3 text-sm text-paper md:inline-flex"
          >
            Account
          </Link>
          <AuthSlot />
          <details className="md:hidden">
            <summary className="flex min-h-11 min-w-11 list-none items-center justify-center rounded-md border border-line">
              Menu
            </summary>
            <div className="absolute inset-x-0 top-full border-b border-line bg-ink p-4">
              <div className="flex flex-col">
                {NAV.map((n) => (
                  <Link key={n.to} to={n.to} className="min-h-11 py-2 text-sm">
                    {n.label}
                  </Link>
                ))}
                <Link to="/app" className="min-h-11 py-2 text-sm">
                  Customer app
                </Link>
                <Link to="/contact" className="min-h-11 py-2 text-sm">
                  Contact
                </Link>
              </div>
            </div>
          </details>
        </div>
      </header>
      <main>{children ?? <Outlet />}</main>
      <footer className="mt-16 border-t border-line">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-4">
          <div className="space-y-3">
            <Logo />
            <p className="text-sm text-muted">
              Gold Coast built racing simulators. Crate freight Australia-wide.
            </p>
            <p className="text-sm">{BRAND.phone}</p>
            <p className="text-sm text-muted">{BRAND.email}</p>
          </div>
          <div>
            <p className="es-kicker mb-3">Builds</p>
            <ul className="space-y-2 text-sm">
              {PACKAGES.map((p) => (
                <li key={p.slug}>
                  <Link to="/builds/$slug" params={{ slug: p.slug }} className="text-muted hover:text-paper">
                    {p.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/compatibility" className="text-muted hover:text-paper">
                  Compatibility checker
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="es-kicker mb-3">Australia</p>
            <ul className="space-y-2 text-sm">
              {CITIES.slice(0, 6).map((c) => (
                <li key={c.slug}>
                  <Link to="/au/$city" params={{ city: c.slug }} className="text-muted hover:text-paper">
                    Sim racing {c.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/au" className="text-muted hover:text-paper">
                  All cities
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="es-kicker mb-3">Guides</p>
            <ul className="space-y-2 text-sm">
              {GUIDES.slice(0, 4).map((g) => (
                <li key={g.slug}>
                  <Link to="/guides/$slug" params={{ slug: g.slug }} className="text-muted hover:text-paper">
                    {g.title}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/privacy" className="text-muted hover:text-paper">
                  Privacy
                </Link>
                {" · "}
                <Link to="/terms" className="text-muted hover:text-paper">
                  Terms
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <p className="border-t border-line px-4 py-6 text-center text-xs text-subtle">
          © {new Date().getFullYear()} Everything Simulated · Gold Coast, Queensland · Prices AUD ex GST
        </p>
      </footer>
    </div>
  );
}
