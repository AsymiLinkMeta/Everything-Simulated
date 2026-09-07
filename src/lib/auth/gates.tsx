import { Link } from "@tanstack/react-router";
import { useCurrentUserState } from "./use-current-user";
import { authClient } from "./client";

export function RedirectToSignIn() {
  return (
    <main className="grid min-h-dvh place-items-center bg-ink px-6 text-center text-paper">
      <div className="es-card max-w-md space-y-4 p-6">
        <h1 className="text-xl font-medium">Sign in required</h1>
        <p className="text-sm text-muted">
          You need an account to access this part of the site.
        </p>
        <Link
          to="/login"
          className="inline-flex min-h-11 items-center rounded-[15px] border border-white/10 bg-black px-4 text-sm text-white transition-colors hover:border-white/20 hover:bg-black/90"
        >
          Go to sign in
        </Link>
      </div>
    </main>
  );
}

export function UserButton() {
  const { user } = useCurrentUserState();
  if (!user) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-sm text-muted sm:inline">
        {user.displayName ?? user.email}
      </span>
      <button
        type="button"
        className="grid size-8 place-items-center rounded-[15px] border border-white/10 bg-black text-xs font-medium text-white"
        onClick={() => authClient.signOut().then(() => (window.location.href = "/"))}
        title="Sign out"
      >
        {(user.displayName ?? user.email ?? "?")[0]?.toUpperCase()}
      </button>
    </div>
  );
}
