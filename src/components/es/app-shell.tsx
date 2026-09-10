import "./es-chrome";
import { useState } from "react";
import { Link, Outlet } from "@tanstack/react-router";
import { Navigate } from "react-router-dom";
import { Calendar, Gauge, LayoutDashboard, LifeBuoy, Menu, MessageSquare, Package, Wrench } from "lucide-react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useQuery } from "@tanstack/react-query";
import { getProfile } from "@/lib/es/server";
import { AuthSlot, Logo } from "./bits";

const TABS = [
  { to: "/app", label: "Home", icon: LayoutDashboard },
  { to: "/app/build", label: "Build", icon: Gauge },
  { to: "/app/quotes", label: "Quotes", icon: Wrench },
  { to: "/app/orders", label: "Orders", icon: Package },
  { to: "/app/service", label: "Service", icon: LifeBuoy },
  { to: "/app/chat", label: "Expert", icon: MessageSquare },
  { to: "/app/book", label: "Book", icon: Calendar },
] as const;

export function AppShell() {
  const { user, isPending } = useCurrentUserState();
  const [menuOpen, setMenuOpen] = useState(false);
  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: () => getProfile(),
    enabled: Boolean(user),
  });

  if (isPending) {
    return <div className="es-page" style={{ display: "grid", placeItems: "center" }}>Loading account…</div>;
  }
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="es-page">
      <header className="es-appbar es-app-header">
        <Logo compact />
        <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>Build app</p>
        <nav className="es-nav" aria-label="App">
          {TABS.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              className="es-nav-link"
              activeOptions={{ exact: t.to === "/app" }}
              activeProps={{ className: "es-nav-link is-active" }}
            >
              <t.icon className="size-4" />
              {t.label}
            </Link>
          ))}
        </nav>
        {profile.data?.isStaff ? (
          <Link to="/staff" className="es-nav-link" style={{ color: "var(--es-red)", borderColor: "var(--es-red)" }}>
            Staff
          </Link>
        ) : null}
        <AuthSlot />
        <div className="es-app-hamburger-wrap">
          <button
            type="button"
            className="es-app-hamburger-btn"
            aria-label="Open app navigation"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <Menu className="size-5" />
          </button>
          {menuOpen ? (
            <nav className="es-app-hamburger-menu" aria-label="App navigation" onClick={() => setMenuOpen(false)}>
              {TABS.map((t) => (
                <Link
                  key={t.to}
                  to={t.to}
                  activeOptions={{ exact: t.to === "/app" }}
                  activeProps={{ className: "is-active" }}
                >
                  <t.icon className="size-4" />
                  {t.label}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>
      </header>
      <div className="es-wrap" style={{ paddingTop: 24, paddingBottom: 112 }}>
        <Outlet />
      </div>
      <nav className="es-tabbar es-app-tabbar" aria-label="App">
        {TABS.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            activeOptions={{ exact: t.to === "/app" }}
            activeProps={{ className: "is-active" }}
          >
            <t.icon className="size-4" />
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
