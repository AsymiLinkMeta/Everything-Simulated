import { Link } from "@tanstack/react-router";

export function AppErrorComponent({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    <main className="grid min-h-dvh place-items-center bg-ink px-6 text-center text-paper">
      <div className="es-card max-w-md space-y-4 p-6">
        <p className="es-kicker">Error</p>
        <h1 className="text-xl font-medium">Something went wrong</h1>
        <p className="text-sm text-muted">
          {message || "An unexpected error occurred."}
        </p>
        <Link
          to="/"
          className="inline-flex min-h-11 items-center text-sm text-paper"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
