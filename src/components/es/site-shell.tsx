import "./es-chrome";
import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { Facebook, Instagram, Phone } from "lucide-react";
import { useEffect, useState } from "react";
import { BRAND, CITIES, GUIDES, PACKAGES } from "@/lib/es/catalog";
import { CookieDisclaimer, CustomerSignInLink, Logo, StaffLoginLink } from "./bits";

const NAV = [
  { to: "/prebuilds", label: "Prebuilds" },
  { to: "/shop", label: "Shop" },
  { to: "/compatibility", label: "Checker" },
  { to: "/studio", label: "Studio" },
  { to: "/guides", label: "Guides" },
  { to: "/faqs", label: "FAQs" },
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
      <main className="min-w-0">{children ?? <Outlet />}</main>
      <footer className="es-footer">
        <div className="es-footer-grid">
          <div className="es-footer-col">
            <Logo />
            <p>Gold Coast built racing simulators. Crate freight Australia-wide.</p>
            <p>{BRAND.phone}</p>
            <p>{BRAND.email}</p>
            <div className="flex items-center gap-3" style={{ marginTop: 16 }}>
              <a
                href="https://www.facebook.com/EverythingSimulated/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Everything Simulated on Facebook"
                className="es-social-link"
              >
                <Facebook className="size-5" />
              </a>
              <a
                href="https://www.instagram.com/everything_simulated/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Everything Simulated on Instagram"
                className="es-social-link"
              >
                <Instagram className="size-5" />
              </a>
            </div>
            <p className="es-kicker" style={{ marginTop: 16 }}>Staff / Admin</p>
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
                {" · "}
                <Link to="/faqs">FAQs</Link>
              </li>
            </ul>
          </div>
        </div>
        <p className="es-footer-copy">
          © {new Date().getFullYear()} Everything Simulated · Gold Coast, Queensland · Prices AUD ex GST
        </p>
        <p style={{ margin: 0, padding: "0.75rem 1rem 1.25rem", textAlign: "center", fontSize: "0.75rem", color: "var(--es-subtle)" }}>
          Powered by{" "}
          <a href="https://asymilinkmeta.com" target="_blank" rel="noopener noreferrer" style={{ color: "var(--es-muted)" }}>
            AsymiLink Meta
          </a>
        </p>
      </footer>
      <CookieDisclaimer />
    </div>
  );
}
