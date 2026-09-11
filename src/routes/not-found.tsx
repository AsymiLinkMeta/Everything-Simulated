import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-ink px-5 text-paper">
      <div className="es-card max-w-md space-y-4 p-8 text-center">
        <p className="es-kicker">404</p>
        <h1 className="text-2xl font-medium">That page isn’t in the workshop</h1>
        <p className="text-sm text-muted">
          The crate, SKU or city you asked for isn’t here. Try the shop or a prebuilt rig.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link to="/">Home</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/shop">Shop</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/prebuilds">Prebuilds</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
