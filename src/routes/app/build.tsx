import { createFileRoute } from "@tanstack/react-router";
import { CartPanel } from "@/components/es/cart-panel";
import { ProductTile } from "@/components/es/bits";
import { PRODUCTS } from "@/lib/es/catalog";

export const Route = createFileRoute("/app/build")({
  component: AppBuild,
});

function AppBuild() {
  return (
    <div className="space-y-6">
      <div>
        <p className="es-kicker">Builder</p>
        <h1 className="mt-2 text-3xl font-medium">Spec a crate</h1>
      </div>
      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="grid gap-4 sm:grid-cols-2">
          {PRODUCTS.map((item) => (
            <ProductTile key={item.sku} item={item} />
          ))}
        </div>
        <CartPanel />
      </div>
    </div>
  );
}
