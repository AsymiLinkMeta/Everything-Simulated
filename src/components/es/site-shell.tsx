import "./es-chrome";
import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { ChevronDown, Facebook, Instagram, Phone, ShoppingCart } from "lucide-react";
import { useEffect, useState } from "react";
import { CookieDisclaimer, AuthSlot, Logo, StaffLoginLink } from "./bits";
import { ReferralCapture } from "./referral-capture";
import { useCart } from "@/lib/es/cart-store";
import { livePackages } from "@/lib/es/prebuilds";
import { BRAND, CITIES, GUIDES, PACKAGES } from "@/lib/es/catalog";

const SIMULATORS = [
  { to: "/racing", label: "Racing", hint: "Motion, haptic, triples — live catalogue" },
  { to: "/aircraft", label: "Aircraft", hint: "Helicopter and fixed-wing, studio first" },
  { to: "/drones", label: "Drones", hint: "FPV and ground-station trainers" },
] as const;

const NAV = [
  { to: "/training", label: "Training" },
  { to: "/ambassadors", label: "Ambassadors" },
  { to: "/studio", label: "Studio" },
  { to: "/events", label: "Events" },
] as const;

function simActive(pathname: string) {
  return (
    pathname === "/racing" ||
    pathname.startsWith("/racing/") ||
    pathname === "/aircraft" ||
    pathname.startsWith("/aircraft/") ||
    pathname === "/drones" ||
    pathname.startsWith("/drones/")
  );
}

export function SiteShell({ children }: { children?: React.ReactNode }) {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [simOpen, setSimOpen] = useState(false);
  const cartCount = useCart((s) => s.lines.reduce((n, l) => n + l.qty, 0));
  const simOn = simActive(location.pathname);

  useEffect(() => {
    setMenuOpen(false);
    setSimOpen(false);
  }, [location.pathname]);

  return (
    <div className="es-page">
      <ReferralCapture />
      <header className="es-header">
        <div className="es-header-inner">
          <Logo />
          <nav className="es-nav" aria-label="Primary">
            <div className={`es-nav-drop${simOn ? " is-active" : ""}${simOpen ? " is-open" : ""}`}>
              <button
                type="button"
                className={`es-nav-link${simOn ? " is-active" : ""}`}
                aria-expanded={simOpen}
                aria-haspopup="true"
                onClick={() => setSimOpen((v) => !v)}
              >
                Simulators
                <ChevronDown className="size-3.5" />
              </button>
              <div className="es-nav-drop-panel" role="menu">
                {SIMULATORS.map((s) => (
                  <Link key={s.to} to={s.to} role="menuitem">
                    <span>{s.label}</span>
                    <em>{s.hint}</em>
                  </Link>
                ))}
              </div>
            </div>
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
          <Link to="/checkout" className="relative inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-2 text-sm transition-colors hover:border-paper hover:text-paper">
            <ShoppingCart className="size-4" />
            <span className="hidden sm:inline">Cart</span>
            {cartCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[0.625rem] font-semibold leading-4 text-ink">
                {cartCount}
              </span>
            )}
          </Link>
          <AuthSlot />
          <div className={`es-menu ${menuOpen ? "is-open" : ""}`}>
            <button type="button" className="es-menu-toggle" onClick={() => setMenuOpen((v) => !v)} aria-expanded={menuOpen}>
              Menu
            </button>
            {menuOpen && (
              <div className="es-menu-panel">
                <p className="es-menu-label">Simulators</p>
                {SIMULATORS.map((s) => (
                  <Link key={s.to} to={s.to}>
                    {s.label}
                  </Link>
                ))}
                {NAV.map((n) => (
                  <Link key={n.to} to={n.to}>
                    {n.label}
                  </Link>
                ))}
                <Link to="/partners">Partners</Link>
                <Link to="/shop">Racing shop</Link>
                <AuthSlot />
                <Link to="/checkout">Cart ({cartCount})</Link>
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
            <p>Gold Coast simulator workshop. Try before you buy. Racing, aircraft, drones and training. Crate freight Australia-wide.</p>
            <p>Gold Coast, Queensland, Australia</p>
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
            <p className="es-kicker">Simulators</p>
            <ul>
              <li>
                <Link to="/racing">Racing</Link>
              </li>
              <li>
                <Link to="/aircraft">Aircraft</Link>
              </li>
              <li>
                <Link to="/drones">Drones</Link>
              </li>
              <li>
                <Link to="/training">Training</Link>
              </li>
              <li>
                <Link to="/ambassadors">Ambassadors</Link>
              </li>
              <li>
                <Link to="/studio">Studio</Link>
              </li>
              <li>
                <Link to="/events">Events & catering</Link>
              </li>
              <li>
                <Link to="/partners">Partners</Link>
              </li>
            </ul>
          </div>
          <div className="es-footer-col">
            <p className="es-kicker">Racing tools</p>
            <ul>
              {(livePackages().length ? livePackages() : PACKAGES).map((p) => (
                <li key={p.slug}>
                  <Link to="/prebuilds/$slug" params={{ slug: p.slug }}>
                    {p.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/shop">Parts shop</Link>
              </li>
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
                {" · "}
                <Link to="/order">Track an order</Link>
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
