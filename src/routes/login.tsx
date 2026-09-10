import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { useAuthState } from "@/lib/auth/provider";
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

function Login() {
  const [params] = useSearchParams();
  const staff = params.get("portal") === "staff";
  const next = staff ? "/staff" : "/app";
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuthState();

  useEffect(() => {
    if (user) navigate(next, { replace: true });
  }, [user, next, navigate]);

  async function onEmail(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
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
          <h1 className="text-xl font-medium">{staff ? "Login" : "Sign In"}</h1>
          <p className="mt-1 text-sm text-muted">
            {staff
              ? "Workshop, sales and admin. Customer accounts use Sign In in the header."
              : "Quotes, orders and bookings. Your customer account lives here."}
          </p>
        </div>
        {authEnabled ? (
          <>
            {GROK_PROVIDERS.length > 0 && (
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
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
              {error ? <p className="text-sm text-esred">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Please wait…" : staff ? "Login" : mode === "up" ? "Create account" : "Sign In"}
              </Button>
            </form>
            {staff ? (
              <a href="/login" className="block text-sm text-muted">
                Customer? Sign In in the header.
              </a>
            ) : (
              <button
                type="button"
                className="text-sm text-muted"
                onClick={() => setMode(mode === "up" ? "in" : "up")}
              >
                {mode === "up" ? "Have an account? Sign In" : "New here? Create an account"}
              </button>
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
