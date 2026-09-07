import "./es-chrome";
import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { Phone } from "lucide-react";
import { useEffect, useState } from "react";
import { BRAND, CITIES, GUIDES, PACKAGES } from "@/lib/es/catalog";
import { CookieDisclaimer, CustomerSignInLink, Logo, StaffLoginLink } from "./bits";

const NAV = [
  { to: "/builds", label: "Builds" },
  { to: "/shop", label: "Shop" },
  { to: "/compatibility", label: "Checker" },
  { to: "/studio", label: "Studio" },
  { to: "/guides", label: "Guides" },
  { to: "/au", label: "Australia" },
] as const;

export function SiteShell({ children }: { children?: React.ReactNode }) {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

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
          <CustomerSignInLink />
          <div className={`es-menu ${menuOpen ? "is-open" : ""}`}>
            <button type="button" className="es-menu-toggle" onClick={() => setMenuOpen((v) => !v)} aria-expanded={menuOpen}>
              Menu
            </button>
            {menuOpen && (
              <div className="es-menu-panel">
                {NAV.map((n) => (
                  <Link key={n.to} to={n.to}>
                    {n.label}
                  </Link>
                ))}
                <CustomerSignInLink className="" />
                <Link to="/contact">Contact</Link>
                <a href={`tel:${BRAND.phone.replace(/\s/g, "")}`}>{BRAND.phone}</a>
              </div>
            )}
          </div>
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
            <p className="es-kicker" style={{ marginTop: 16 }}>Staff</p>
            <p>
              <StaffLoginLink />
            </p>
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
