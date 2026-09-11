import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { GROK_PROVIDERS, authClient, authEnabled, requestPasswordReset, signIn, updatePassword } from "@/lib/auth/client";
import { RECOVERY_FLAG, useAuthState } from "@/lib/auth/provider";
import { supabase } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/es/bits";
import { pageHead } from "@/lib/es/seo";

export const Route = createFileRoute("/login")({
  head: () =>
    pageHead({
      title: "Sign In | Everything Simulated",
      description: "Sign in to your Everything Simulated customer account for quotes, orders and bookings.",
      path: "/login",
    }),
  component: Login,
});

function safeNext(raw: string | null, staff: boolean) {
  if (staff) return "/staff";
  if (raw && (raw.startsWith("/app") || raw.startsWith("/staff") || raw.startsWith("/checkout") || raw.startsWith("/order"))) {
    return raw;
  }
  return "/app";
}

function initialMode(): "in" | "up" | "reset" | "new" {
  try {
    if (sessionStorage.getItem(RECOVERY_FLAG) === "1") return "new";
  } catch {
    // ignore
  }
  if (typeof window === "undefined") return "in";
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  if (hash.get("type") === "recovery") return "new";
  return "in";
}

function Login() {
  const [params] = useSearchParams();
  const staff = params.get("portal") === "staff";
  const next = safeNext(params.get("next"), staff);
  const [mode, setMode] = useState<"in" | "up" | "reset" | "new">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuthState();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("new");
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user && mode !== "new" && mode !== "reset") navigate(next, { replace: true });
  }, [user, next, navigate, mode]);

  async function onEmail(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setInfo(null);
    if (!staff && mode === "reset") {
      const { error: err } = await requestPasswordReset(email);
      setPending(false);
      if (err) {
        setError(err.message ?? "Could not send reset");
        return;
      }
      setInfo("If that account exists, a reset link is on its way.");
      return;
    }
    if (!staff && mode === "new") {
      if (password.length < 8) {
        setPending(false);
        setError("Use at least 8 characters.");
        return;
      }
      if (password !== confirm) {
        setPending(false);
        setError("Passwords do not match.");
        return;
      }
      const { error: err } = await updatePassword(password);
      setPending(false);
      if (err) {
        setError(err.message ?? "Could not update password");
        return;
      }
      try {
        sessionStorage.removeItem(RECOVERY_FLAG);
      } catch {
        // ignore
      }
      navigate(next, { replace: true });
      return;
    }
    if (!staff && mode === "up") {
      const { error: err } = await authClient.signUp.email({ email, password, name, callbackURL: next });
      setPending(false);
      if (err) {
        setError(err.message ?? "Could not create account");
        return;
      }
    } else {
      const { error: err } = await authClient.signIn.email({ email, password, callbackURL: next });
      setPending(false);
      if (err) {
        setError(err.message ?? (staff ? "Could not log in" : "Could not sign in"));
        return;
      }
    }
    navigate(next, { replace: true });
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-ink px-4 text-paper">
      <div className="es-card w-full max-w-sm space-y-5 p-6">
        <Logo />
        <div>
          <h1 className="text-xl font-medium">
            {staff ? "Login" : mode === "new" ? "Set a new password" : mode === "reset" ? "Reset password" : "Sign In"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {staff
              ? "Workshop, sales and admin. Customer accounts use Sign In in the header."
              : mode === "new"
                ? "Choose a new password for this account."
                : "Quotes, orders and bookings. Your customer account lives here."}
          </p>
        </div>
        {authEnabled ? (
          <>
            {GROK_PROVIDERS.length > 0 && mode !== "reset" && mode !== "new" && (
              <>
                <div className="space-y-2">
                  {GROK_PROVIDERS.map((p) => (
                    <Button
                      key={p.providerId}
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={async () => {
                        setPending(true);
                        setError(null);
                        try {
                          await signIn(p.providerId, { callbackURL: next });
                        } catch (err) {
                          setPending(false);
                          setError(
                            err instanceof Error
                              ? err.message
                              : `Could not continue with ${p.label}. Enable it in Supabase Auth providers.`,
                          );
                        }
                      }}
                    >
                      Continue with {p.label}
                    </Button>
                  ))}
                </div>
                <p className="text-center text-xs text-subtle">
                  Google and X use your Supabase Auth providers. Email still works if those are off.
                </p>
                <p className="text-center text-xs text-subtle">or email</p>
              </>
            )}
            <form className="space-y-3" onSubmit={onEmail}>
              {!staff && mode === "up" ? (
                <Input
                  placeholder="Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              ) : null}
              {mode !== "new" ? (
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              ) : null}
              {mode !== "reset" ? (
                <Input
                  type="password"
                  placeholder={mode === "new" ? "New password" : "Password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                />
              ) : null}
              {mode === "new" ? (
                <Input
                  type="password"
                  placeholder="Confirm password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  minLength={8}
                  required
                />
              ) : null}
              {error ? <p className="text-sm text-esred">{error}</p> : null}
              {info ? <p className="text-sm text-muted">{info}</p> : null}
              <Button type="submit" className="w-full" disabled={pending}>
                {pending
                  ? "Please wait…"
                  : staff
                    ? "Login"
                    : mode === "up"
                      ? "Create account"
                      : mode === "reset"
                        ? "Send reset link"
                        : mode === "new"
                          ? "Save password"
                          : "Sign In"}
              </Button>
            </form>
            {staff ? (
              <a href="/login" className="block text-sm text-muted">
                Customer? Sign In in the header.
              </a>
            ) : (
              <div className="space-y-2">
                {mode !== "new" ? (
                  <button
                    type="button"
                    className="text-sm text-muted"
                    onClick={() => {
                      setMode(mode === "up" ? "in" : "up");
                      setError(null);
                      setInfo(null);
                    }}
                  >
                    {mode === "up" ? "Have an account? Sign In" : "New here? Create an account"}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="block text-sm text-muted"
                  onClick={() => {
                    setMode(mode === "reset" || mode === "new" ? "in" : "reset");
                    setError(null);
                    setInfo(null);
                  }}
                >
                  {mode === "reset" || mode === "new" ? "Back to Sign In" : "Forgot password?"}
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted">{staff ? "Login is disabled." : "Sign-in is disabled."}</p>
        )}
        <Link to="/" className="block text-sm text-muted">
          Back to the site
        </Link>
      </div>
    </main>
  );
}
