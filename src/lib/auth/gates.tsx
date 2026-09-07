import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function SignedIn({ children }: { children: ReactNode }) {
  return null;
}

export function SignedOut({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function RedirectToSignIn() {
  return <Link to="/login">Sign in</Link>;
}

export function UserButton() {
  return null;
}

export function SignInGate({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  return <>{fallback ?? children}</>;
}
