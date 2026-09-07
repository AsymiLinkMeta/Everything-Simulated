import "./es-chrome";
import { Link, Outlet } from "@tanstack/react-router";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Boxes, Calendar, ClipboardList, Shield, Users, Wrench } from "lucide-react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getProfile } from "@/lib/es/server";
import { AuthSlot, Logo } from "./bits";

const TABS = [
  { to: "/staff", label: "Pipeline", icon: ClipboardList },
  { to: "/staff/catalog", label: "Catalog", icon: Boxes },
  { to: "/staff/quotes", label: "Quotes", icon: Wrench },
  { to: "/staff/jobs", label: "Jobs", icon: Wrench },
  { to: "/staff/bookings", label: "Bookings", icon: Calendar },
  { to: "/staff/team", label: "Team", icon: Users },
] as const;

export function StaffShell() {
  const { user, isPending } = useCurrentUserState();
  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: () => getProfile(),
    enabled: Boolean(user),
  });

  if (isPending || (user && profile.isPending)) {
    return <div className="es-page" style={{ display: "grid", placeItems: "center" }}>Opening workshop…</div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!profile.data?.isStaff) {
    return (
      <div className="es-page" style={{ display: "grid", placeItems: "center", padding: 24 }}>
        <div className="es-card" style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <Shield className="mx-auto size-6 text-muted" />
          <h1>Staff only</h1>
          <p className="text-muted">
            This portal is for workshop, sales and admin. The first signed-in account becomes admin.
          </p>
          <Link to="/app" className="es-btn" style={{ marginTop: 16 }}>
            Back to customer app
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="es-staff">
      <aside className="es-sidebar">
        <div className="es-appbar" style={{ position: "static" }}>
          <Logo compact />
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>Staff</p>
            <p className="es-kicker" style={{ textTransform: "capitalize" }}>
              {profile.data.role}
            </p>
          </div>
        </div>
        <nav>
          {TABS.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              activeOptions={{ exact: t.to === "/staff" }}
              activeProps={{ className: "is-active" }}
            >
              <t.icon className="size-4" />
              {t.label}
            </Link>
          ))}
        </nav>
        <Link to="/app" className="es-nav-link" style={{ marginTop: "auto" }}>
          Customer app
        </Link>
      </aside>
      <div>
        <header className="es-appbar" style={{ justifyContent: "flex-end" }}>
          <Logo compact />
          <AuthSlot />
        </header>
        <div className="es-wrap" style={{ paddingTop: 24, paddingBottom: 96 }}>
          <Outlet />
        </div>
        <nav className="es-tabbar">
          {TABS.slice(0, 5).map((t) => (
            <Link
              key={t.to}
              to={t.to}
              activeOptions={{ exact: t.to === "/staff" }}
              activeProps={{ className: "is-active" }}
            >
              <t.icon className="size-4" />
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
