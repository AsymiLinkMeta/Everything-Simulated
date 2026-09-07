import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/es/bits";
import { pageHead } from "@/lib/es/seo";

export const Route = createFileRoute("/login")({
  head: () =>
    pageHead({
      title: "Sign in | Everything Simulated",
      description: "Customer and staff sign-in for quotes, bookings and the workshop portal.",
      path: "/login",
    }),
  component: Login,
});

function Login() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onEmail(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fn =
      mode === "up"
        ? authClient.signUp.email({ email, password, name, callbackURL: "/app" })
        : authClient.signIn.email({ email, password, callbackURL: "/app" });
    const { error: err } = await fn;
    setPending(false);
    if (err) setError(err.message ?? "Could not sign in");
    else window.location.href = "/app";
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-ink px-4 text-paper">
      <div className="es-card w-full max-w-sm space-y-5 p-6">
        <Logo />
        <div>
          <h1 className="text-xl font-medium">Sign in</h1>
          <p className="mt-1 text-sm text-muted">Quotes, bookings and the workshop live here.</p>
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
                      onClick={() => signIn(p.providerId, { callbackURL: "/app" })}
                    >
                      Continue with {p.label}
                    </Button>
                  ))}
                </div>
                <p className="text-center text-xs text-subtle">or email</p>
              </>
            )}
            <form className="space-y-3" onSubmit={onEmail}>
              {mode === "up" ? (
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
                {pending ? "Please wait…" : mode === "up" ? "Create account" : "Sign in"}
              </Button>
            </form>
            <button
              type="button"
              className="text-sm text-muted"
              onClick={() => setMode(mode === "up" ? "in" : "up")}
            >
              {mode === "up" ? "Have an account? Sign in" : "New here? Create an account"}
            </button>
          </>
        ) : (
          <p className="text-sm text-muted">Sign-in is disabled.</p>
        )}
        <Link to="/" className="block text-sm text-muted">
          Back to the site
        </Link>
      </div>
    </main>
  );
}
