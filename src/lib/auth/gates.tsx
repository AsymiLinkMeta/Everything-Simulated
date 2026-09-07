import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useCurrentUserState } from "./use-current-user";
import { signOut } from "./client";

export function SignedIn({ children }: { children: ReactNode }) {
  const { user } = useCurrentUserState();
  return user ? <>{children}</> : null;
}

export function SignedOut({ children }: { children: ReactNode }) {
  const { user } = useCurrentUserState();
  return user ? null : <>{children}</>;
}

export function RedirectToSignIn() {
  return <Link to="/login">Sign in</Link>;
}

export function UserButton() {
  const { user } = useCurrentUserState();
  if (!user) return null;
  return (
    <button
      type="button"
      onClick={() => signOut()}
      className="es-nav-link"
      title="Sign out"
    >
      {user.displayName ?? user.email}
    </button>
  );
}

export function SignInGate({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const { user } = useCurrentUserState();
  return <>{user ? children : fallback ?? children}</>;
}
