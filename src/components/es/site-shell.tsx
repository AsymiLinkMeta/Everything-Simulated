import "./es-chrome";
import { Link, Outlet } from "@tanstack/react-router";
import { Phone } from "lucide-react";
import { BRAND, CITIES, GUIDES, PACKAGES } from "@/lib/es/catalog";
import { AuthSlot, CookieDisclaimer, Logo } from "./bits";

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
    <div className="es-page">
      <header className="es-header">
        <div className="es-header-inner">
          <Logo />
          <nav className="es-nav" aria-label="Primary">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} className="es-nav-link">
                {n.label}
              </Link>
            ))}
          </nav>
          <a href={`tel:${BRAND.phone.replace(/\s/g, "")}`} className="es-header-phone">
            <Phone className="size-4" />
            {BRAND.phone}
          </a>
          <Link to="/app" className="es-header-account">
            Account
          </Link>
          <AuthSlot />
          <details className="es-menu">
            <summary>Menu</summary>
            <div className="es-menu-panel">
              {NAV.map((n) => (
                <Link key={n.to} to={n.to}>
                  {n.label}
                </Link>
              ))}
              <Link to="/app">Customer app</Link>
              <Link to="/contact">Contact</Link>
              <a href={`tel:${BRAND.phone.replace(/\s/g, "")}`}>{BRAND.phone}</a>
            </div>
          </details>
        </div>
      </header>
      <main>{children ?? <Outlet />}</main>
      <footer className="es-footer">
        <div className="es-footer-grid">
          <div className="es-footer-col">
            <Logo />
            <p>Gold Coast built racing simulators. Crate freight Australia-wide.</p>
            <p>{BRAND.phone}</p>
            <p>{BRAND.email}</p>
          </div>
          <div className="es-footer-col">
            <p className="es-kicker">Builds</p>
            <ul>
              {PACKAGES.map((p) => (
                <li key={p.slug}>
                  <Link to="/builds/$slug" params={{ slug: p.slug }}>
                    {p.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/compatibility">Compatibility checker</Link>
              </li>
            </ul>
          </div>
          <div className="es-footer-col">
            <p className="es-kicker">Australia</p>
            <ul>
              {CITIES.slice(0, 6).map((c) => (
                <li key={c.slug}>
                  <Link to="/au/$city" params={{ city: c.slug }}>
                    Sim racing {c.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/au">All cities</Link>
              </li>
            </ul>
          </div>
          <div className="es-footer-col">
            <p className="es-kicker">Guides</p>
            <ul>
              {GUIDES.slice(0, 4).map((g) => (
                <li key={g.slug}>
                  <Link to="/guides/$slug" params={{ slug: g.slug }}>
                    {g.title}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/privacy">Privacy</Link>
                {" · "}
                <Link to="/terms">Terms</Link>
              </li>
            </ul>
          </div>
        </div>
        <p className="es-footer-copy">
          © {new Date().getFullYear()} Everything Simulated · Gold Coast, Queensland · Prices AUD ex GST
        </p>
      </footer>
      <CookieDisclaimer />
    </div>
  );
}
