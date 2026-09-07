import { Link, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Boxes, Calendar, ClipboardList, Shield, Users, Wrench } from "lucide-react";
import { RedirectToSignIn } from "@/lib/auth/gates";
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
    return (
      <div className="grid min-h-dvh place-items-center bg-ink text-muted">Opening workshop…</div>
    );
  }
  if (!user) return <RedirectToSignIn />;
  if (!profile.data?.isStaff) {
    return (
      <div className="grid min-h-dvh place-items-center bg-ink px-6 text-center">
        <div className="es-card max-w-md space-y-3 p-6">
          <Shield className="mx-auto size-6 text-muted" />
          <h1 className="text-xl font-medium">Staff only</h1>
          <p className="text-sm text-muted">
            This portal is for workshop, sales and admin. The first signed-in account becomes admin.
          </p>
          <Link to="/app" className="inline-flex min-h-11 items-center text-sm text-paper">
            Back to customer app
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-ink text-paper md:grid md:grid-cols-[220px_1fr]">
      <aside className="hidden border-r border-line md:flex md:flex-col">
        <div className="flex items-center gap-2 border-b border-line px-4 py-4">
          <Logo compact />
          <div>
            <p className="text-sm font-medium">Staff</p>
            <p className="text-xs capitalize text-muted">{profile.data.role}</p>
          </div>
        </div>
        <nav className="flex flex-col p-2">
          {TABS.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              className="flex min-h-11 items-center gap-2 rounded-md px-3 text-sm text-muted hover:bg-raised hover:text-paper"
              activeOptions={{ exact: t.to === "/staff" }}
              activeProps={{ className: "bg-raised text-paper" }}
            >
              <t.icon className="size-4" />
              {t.label}
            </Link>
          ))}
        </nav>
        <Link to="/app" className="mt-auto px-4 py-4 text-sm text-muted hover:text-paper">
          Customer app
        </Link>
      </aside>
      <div>
        <header className="flex items-center justify-between border-b border-line px-4 py-3 md:justify-end">
          <Logo compact />
          <AuthSlot />
        </header>
        <div className="px-4 py-6 pb-24 md:px-8">
          <Outlet />
        </div>
        <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-ink pb-[env(safe-area-inset-bottom)] md:hidden">
          {TABS.slice(0, 5).map((t) => (
            <Link
              key={t.to}
              to={t.to}
              className="flex min-h-14 flex-col items-center justify-center gap-1 text-xs text-muted"
              activeOptions={{ exact: t.to === "/staff" }}
              activeProps={{ className: "text-paper" }}
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
