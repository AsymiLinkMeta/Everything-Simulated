import { Link, Outlet } from "@tanstack/react-router";
import { Calendar, Gauge, LayoutDashboard, MessageSquare, Wrench } from "lucide-react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useQuery } from "@tanstack/react-query";
import { getProfile } from "@/lib/es/server";
import { AuthSlot, Logo } from "./bits";

const TABS = [
  { to: "/app", label: "Home", icon: LayoutDashboard },
  { to: "/app/build", label: "Build", icon: Gauge },
  { to: "/app/quotes", label: "Quotes", icon: Wrench },
  { to: "/app/chat", label: "Expert", icon: MessageSquare },
  { to: "/app/book", label: "Book", icon: Calendar },
] as const;

export function AppShell() {
  const { user, isPending } = useCurrentUserState();
  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: () => getProfile(),
    enabled: Boolean(user),
  });

  if (isPending) {
    return (
      <div className="grid min-h-dvh place-items-center bg-ink text-muted">
        Loading account…
      </div>
    );
  }
  if (!user) return <RedirectToSignIn />;

  return (
    <div className="min-h-dvh bg-ink text-paper">
      <header className="sticky top-0 z-40 border-b border-line bg-ink">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Logo compact />
          <p className="text-sm font-medium">Build app</p>
          <nav className="ml-auto hidden items-center md:flex">
            {TABS.map((t) => (
              <Link
                key={t.to}
                to={t.to}
                className="inline-flex min-h-11 items-center gap-2 rounded-[15px] border border-white/10 bg-black px-3 text-sm text-white transition-colors hover:border-white/20 hover:bg-black/90"
                activeOptions={{ exact: t.to === "/app" }}
                activeProps={{ className: "text-paper" }}
              >
                <t.icon className="size-4" />
                {t.label}
              </Link>
            ))}
          </nav>
          {profile.data?.isStaff ? (
            <Link to="/staff" className="hidden rounded-[15px] border border-white/10 bg-black px-4 text-sm text-esred md:inline">
              Staff
            </Link>
          ) : null}
          <AuthSlot />
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 py-6 pb-28 md:pb-10">
        <Outlet />
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className="grid grid-cols-5">
          {TABS.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-[15px] px-2 text-xs text-white"
              activeOptions={{ exact: t.to === "/app" }}
              activeProps={{ className: "text-paper" }}
            >
              <t.icon className="size-4" />
              {t.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
