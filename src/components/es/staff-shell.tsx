import "./es-chrome";
import { useState, useEffect } from "react";
import { Link, Outlet, applyHeadPayload } from "@tanstack/react-router";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Boxes,
  Calendar,
  ClipboardList,
  FileText,
  Handshake,
  Inbox,
  Menu,
  Package,
  Shield,
  Sparkles,
  Tags,
  Truck,
  Users,
  Wrench,
  Link2,
} from "lucide-react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getProfile } from "@/lib/es/server";
import { unreadInboxCount } from "@/lib/es/inbox";
import { pageHead } from "@/lib/es/seo";
import { AuthSlot, Logo } from "./bits";

const TABS = [
  { to: "/staff", label: "Pipeline", icon: ClipboardList },
  { to: "/staff/service", label: "Inbox", icon: Inbox },
  { to: "/staff/agent", label: "Agent", icon: Sparkles },
  { to: "/staff/crm", label: "CRM", icon: Handshake },
  { to: "/staff/oms", label: "OMS", icon: Truck },
  { to: "/staff/catalog", label: "Catalog", icon: Boxes },
  { to: "/staff/prebuilds", label: "Prebuilds", icon: Package },
  { to: "/staff/rules", label: "Rules", icon: Link2 },
  { to: "/staff/brands", label: "Brands", icon: Tags },
  { to: "/staff/quotes", label: "Quotes", icon: FileText },
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
  const unread = useQuery({
    queryKey: ["inbox-unread"],
    queryFn: unreadInboxCount,
    enabled: Boolean(user),
    refetchInterval: 15000,
  });

  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    applyHeadPayload(
      pageHead({
        title: "Staff | Everything Simulated",
        description: "Workshop portal.",
        path: "/staff",
        index: false,
      }),
    );
  }, []);

  if (isPending || (user && profile.isPending)) {
    return (
      <div className="es-page" style={{ display: "grid", placeItems: "center" }}>
        Opening workshop…
      </div>
    );
  }
  if (!user) return <Navigate to="/login?portal=staff" replace />;
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

  const unreadN = unread.data ?? 0;
  const labelFor = (tab: (typeof TABS)[number]) =>
    tab.to === "/staff/service" && unreadN > 0 ? `${tab.label} (${unreadN})` : tab.label;

  return (
    <div className="es-staff">
      <div className="es-staff-bg" aria-hidden="true">
        <img src="/rigs/Everything_Simulated_Hero copy.jpg" alt="" />
      </div>
      <aside className="es-sidebar">
        <div className="es-sidebar-head">
          <Logo compact />
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>Staff</p>
            <p className="es-kicker" style={{ textTransform: "capitalize" }}>
              {profile.data.role}
            </p>
          </div>
        </div>
        <nav className="es-sidebar-nav">
          {TABS.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              activeOptions={{ exact: t.to === "/staff" }}
              activeProps={{ className: "is-active" }}
            >
              <t.icon className="size-4" />
              {labelFor(t)}
            </Link>
          ))}
        </nav>
        <Link to="/app" className="es-sidebar-link">
          Customer app
        </Link>
      </aside>
      <div
        className="es-staff-main"
        style={{ height: "100dvh", minHeight: 0, overflowY: "auto", overscrollBehavior: "contain" }}
      >
        <header className="es-appbar es-staff-header">
          <div className="es-staff-header-left">
            <Logo compact />
          </div>
          <div className="es-staff-topnav">
            {TABS.map((t) => (
              <Link
                key={t.to}
                to={t.to}
                activeOptions={{ exact: t.to === "/staff" }}
                activeProps={{ className: "is-active" }}
                className="es-staff-topnav-link"
              >
                <t.icon className="size-4" />
                <span>{labelFor(t)}</span>
              </Link>
            ))}
          </div>
          <div className="es-staff-header-center">
            <AuthSlot />
          </div>
          <div className="es-staff-hamburger-wrap">
            <button
              type="button"
              className="es-staff-hamburger-btn"
              aria-label="Navigation menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <Menu className="size-5" />
            </button>
            {menuOpen ? (
              <nav className="es-staff-hamburger-menu" onClick={() => setMenuOpen(false)}>
                {TABS.map((t) => (
                  <Link
                    key={t.to}
                    to={t.to}
                    activeOptions={{ exact: t.to === "/staff" }}
                    activeProps={{ className: "is-active" }}
                  >
                    <t.icon className="size-4" />
                    {labelFor(t)}
                  </Link>
                ))}
              </nav>
            ) : null}
          </div>
        </header>
        <div className="es-wrap" style={{ paddingTop: 24, paddingBottom: 96 }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
