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
          className="inline-flex min-h-11 items-center text-sm text-paper"
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
        className="grid size-8 place-items-center rounded-md border border-line text-xs font-medium text-paper"
        onClick={() => authClient.signOut().then(() => (window.location.href = "/"))}
        title="Sign out"
      >
        {(user.displayName ?? user.email ?? "?")[0]?.toUpperCase()}
      </button>
    </div>
  );
}
