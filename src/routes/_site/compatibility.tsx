import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CartPanel } from "@/components/es/cart-panel";
import { ProductTile } from "@/components/es/bits";
import { fetchProducts } from "@/lib/es/product-cache";
import { pageHead } from "@/lib/es/seo";

export const Route = createFileRoute("/_site/compatibility")({
  head: () =>
    pageHead({
      title: "Sim racing compatibility checker Australia | Everything Simulated",
      description:
        "Check Simagic, Trak Racer, Exodus and SIMRIG builds before you buy. Torque, payload, QR and mounts are enforced by rules — not guessed by chat.",
      path: "/compatibility",
    }),
  component: Compatibility,
});

function Compatibility() {
  const products = useQuery({ queryKey: ["products"], queryFn: () => fetchProducts() });
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <p className="es-kicker">Build engine</p>
      <h1 className="mt-3 text-4xl font-medium">Compatibility checker</h1>
      <p className="mt-4 max-w-2xl text-muted">
        Rules first. The expert chatbot can explain a result — it cannot override a block. Load a
        package, swap a chassis, and watch payload and torque update.
      </p>
      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
          {(products.data ?? []).map((item) => (
            <ProductTile key={item.sku} item={item} />
          ))}
        </div>
        <div className="lg:sticky lg:top-24 lg:self-start">
          <CartPanel />
        </div>
      </div>
    </div>
  );
}
