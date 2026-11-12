import "./es-chrome";
import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { ArrowUpRight, ChevronDown, Facebook, Instagram, Menu, Phone, ShoppingBag, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BrandMark } from "./bits";
import { ConsentBanner, CookieSettingsButton } from "./consent-banner";
import { ReferralCapture } from "./referral-capture";
import { CartDrawer } from "./cart-drawer";
import { useCart } from "@/lib/es/cart-store";
import { useCartDrawer } from "@/lib/es/cart-drawer-store";
import { useQuery } from "@tanstack/react-query";
import { fetchPrebuildLinks } from "@/lib/es/prebuilds";
import { BRAND, CITIES } from "@/lib/es/catalog";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { signOut } from "@/lib/auth/client";

const SIMULATORS = [
  { to: "/racing", label: "Racing", hint: "Motion, haptic and triple-screen rigs" },
  { to: "/aircraft", label: "Aircraft", hint: "Helicopter and fixed-wing cockpits" },
  { to: "/drones", label: "Drones", hint: "FPV and ground-station trainers" },
  { to: "/training", label: "Training", hint: "Driver, pilot and industrial programs" },
] as const;

const NAV = [
  { to: "/prebuilds", label: "Prebuilds" },
  { to: "/shop", label: "Shop" },
  { to: "/build", label: "Builder" },
  { to: "/studio", label: "Studio" },
  { to: "/ambassadors", label: "Ambassadors" },
] as const;

const telHref = `tel:${BRAND.phone.replace(/\s/g, "")}`;
const isOn = (pathname: string, to: string) => pathname === to || pathname.startsWith(`${to}/`);

export function SiteShell({ children }: { children?: React.ReactNode }) {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [simOpen, setSimOpen] = useState(false);
  const cartCount = useCart((s) => s.lines.reduce((n, l) => n + l.qty, 0));
  const openCart = useCartDrawer((s) => s.show);
  const simOn = SIMULATORS.some((s) => isOn(location.pathname, s.to));
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMenuOpen(false);
    setSimOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.classList.toggle("ds-lock", menuOpen);
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.classList.remove("ds-lock");
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!simOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!dropRef.current?.contains(e.target as Node)) setSimOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSimOpen(false);
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [simOpen]);

  return (
    <div className="es-page">
      <a href="#main" className="ds-skip">Skip to content</a>
      <ReferralCapture />
      <header className="ds-header">
        <div className="ds-container ds-header-inner">
          <BrandMark />
          <nav className="ds-nav" aria-label="Primary">
            <div className="ds-drop" ref={dropRef}>
              <button
                type="button"
                className={`ds-nav-link${simOn ? " is-active" : ""}`}
                aria-expanded={simOpen}
                aria-controls="ds-sim-panel"
                onClick={() => setSimOpen((v) => !v)}
              >
                Simulators <ChevronDown className="size-4" aria-hidden="true" />
              </button>
              {simOpen ? (
                <div className="ds-drop-panel" id="ds-sim-panel">
                  {SIMULATORS.map((s) => (
                    <Link key={s.to} to={s.to}>
                      <span>{s.label}</span>
                      <em>{s.hint}</em>
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} className={`ds-nav-link${isOn(location.pathname, n.to) ? " is-active" : ""}`}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ds-header-tools">
            <a href={telHref} className="ds-icon-btn ds-header-phone">
              <Phone className="size-4" aria-hidden="true" />
              {BRAND.phone}
            </a>
            <span className="ds-header-signin">
              <AccountLink className="ds-icon-btn" />
            </span>
            <button type="button" className="ds-icon-btn" onClick={openCart} aria-label={cartCount ? `Cart, ${cartCount} item${cartCount === 1 ? "" : "s"}` : "Cart"} data-testid="cart-button">
              <ShoppingBag className="size-5" aria-hidden="true" />
              {cartCount > 0 ? <span className="ds-count" aria-hidden="true">{cartCount}</span> : null}
            </button>
            <button
              type="button"
              className="ds-icon-btn ds-burger"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-controls="ds-menu"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
            >
              {menuOpen ? <X className="size-6" aria-hidden="true" /> : <Menu className="size-6" aria-hidden="true" />}
            </button>
          </div>
        </div>
      </header>
      {menuOpen ? (
        <nav className="ds-menu" id="ds-menu" aria-label="Menu">
          <div className="ds-menu-group">
            <p className="ds-menu-label">Shop</p>
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} className="ds-menu-link">
                {n.label}
              </Link>
            ))}
          </div>
          <div className="ds-menu-group">
            <p className="ds-menu-label">Simulators</p>
            {SIMULATORS.map((s) => (
              <Link key={s.to} to={s.to} className="ds-menu-link">
                {s.label}
              </Link>
            ))}
          </div>
          <div className="ds-menu-group">
            <AccountLink className="ds-menu-small" />
            <Link to="/order" className="ds-menu-small">Track an order</Link>
            <Link to="/contact" className="ds-menu-small">Contact the workshop</Link>
            <a href={telHref} className="ds-menu-small">
              <Phone className="size-4" aria-hidden="true" /> {BRAND.phone}
            </a>
          </div>
        </nav>
      ) : null}
      <main id="main" className="min-w-0">{children ?? <Outlet />}</main>
      <footer className="ds-footer">
        <div className="ds-container">
          <div className="ds-footer-top">
            <div className="ds-footer-brand">
              <BrandMark />
              <p>Simulator workshop on the Gold Coast. Every rig is assembled, tested and set up for its driver before it ships Australia-wide.</p>
              <p>
                <a href={telHref}>{BRAND.phone}</a>
                <br />
                <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a>
              </p>
              <div className="ds-social">
                <a href="https://www.facebook.com/EverythingSimulated/" target="_blank" rel="noopener noreferrer" aria-label="Everything Simulated on Facebook">
                  <Facebook className="size-4" />
                </a>
                <a href="https://www.instagram.com/everything_simulated/" target="_blank" rel="noopener noreferrer" aria-label="Everything Simulated on Instagram">
                  <Instagram className="size-4" />
                </a>
              </div>
            </div>
            <div className="ds-footer-cols">
              <div>
                <h2>Racing</h2>
                <ul>
                  <FooterPrebuilds />
                  <li><Link to="/shop">Parts shop</Link></li>
                  <li><Link to="/build">Rig builder</Link></li>
                  <li><Link to="/compatibility">Compatibility checker</Link></li>
                </ul>
              </div>
              <div>
                <h2>Simulators</h2>
                <ul>
                  {SIMULATORS.map((s) => (
                    <li key={s.to}><Link to={s.to}>{s.label}</Link></li>
                  ))}
                  <li><Link to="/events">Events & hire</Link></li>
                </ul>
              </div>
              <div>
                <h2>Workshop</h2>
                <ul>
                  <li><Link to="/studio">Visit the studio</Link></li>
                  <li><Link to="/ambassadors">Ambassadors</Link></li>
                  <li><Link to="/partners">Partners</Link></li>
                  <li><Link to="/contact">Contact</Link></li>
                  <li><Link to="/faqs">FAQs</Link></li>
                  <li><Link to="/order">Track an order</Link></li>
                </ul>
              </div>
              <div>
                <h2>Delivered to</h2>
                <ul>
                  {CITIES.slice(0, 5).map((c) => (
                    <li key={c.slug}>
                      <Link to="/au/$city" params={{ city: c.slug }}>{c.name}</Link>
                    </li>
                  ))}
                  <li><Link to="/au">All of Australia</Link></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="ds-footer-base">
            <span>© {new Date().getFullYear()} Everything Simulated · Gold Coast, QLD · Prices in AUD</span>
            <ul className="flex flex-wrap items-center gap-x-5">
              <li><Link to="/privacy">Privacy</Link></li>
              <li><Link to="/terms">Terms</Link></li>
              <li><CookieSettingsButton /></li>
              <li>
                <a href="https://asymilinkmeta.com" target="_blank" rel="noopener noreferrer">
                  Powered by AsymiLink Meta <ArrowUpRight className="ml-1 size-3" aria-hidden="true" />
                </a>
              </li>
            </ul>
          </div>
        </div>
      </footer>
      <CartDrawer />
      <ConsentBanner />
    </div>
  );
}

/** Sign in (signed out) or the account / sign-out control (signed in). */
function AccountLink({ className }: { className: string }) {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return <span className={className} aria-hidden="true" style={{ visibility: "hidden" }}>Sign in</span>;
  if (!user) {
    return (
      <Link to="/login" className={className}>
        Sign in
      </Link>
    );
  }
  return (
    <button type="button" className={className} onClick={() => void signOut()} title="Sign out">
      Sign out ({user.displayName ?? user.email})
    </button>
  );
}

/** Footer prebuild links, from Supabase. Falls back to the prebuilds index while loading or on error. */
function FooterPrebuilds() {
  const prebuilds = useQuery({ queryKey: ["prebuild-links"], queryFn: fetchPrebuildLinks });
  if (!prebuilds.data?.length) {
    return (
      <li>
        <Link to="/prebuilds">Prebuilt rigs</Link>
      </li>
    );
  }
  return (
    <>
      {prebuilds.data.map((p) => (
        <li key={p.slug}>
          <Link to="/prebuilds/$slug" params={{ slug: p.slug }}>{p.name}</Link>
        </li>
      ))}
    </>
  );
}
