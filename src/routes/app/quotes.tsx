import { createFileRoute, Link } from "@tanstack/react-router";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { listMyQuotes } from "@/lib/es/server";
import { useCart } from "@/lib/es/cart-store";
import { aud } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { CartLine } from "@/lib/es/types";

export const Route = createFileRoute("/app/quotes")({
  component: Quotes,
});

function Quotes() {
  const quotes = useQuery({ queryKey: ["my-quotes"], queryFn: () => listMyQuotes() });
  const setLines = useCart((s) => s.setLines);
  const setPostcode = useCart((s) => s.setPostcode);
  const navigate = useNavigate();

  function apply(q: { id?: string; lines?: CartLine[] | null; postcode?: string | null }) {
    const lines = Array.isArray(q.lines) ? q.lines.filter((l) => l.sku && l.qty > 0) : [];
    if (!lines.length) {
      toast.error("This quote has no parts saved.");
      return false;
    }
    setLines(lines, q.id ?? null);
    if (q.postcode) setPostcode(q.postcode);
    return true;
  }

  function load(q: { id?: string; lines?: CartLine[] | null; postcode?: string | null }) {
    if (!apply(q)) return;
    toast.success("Quote loaded into your build");
  }

  function checkout(q: { id?: string; lines?: CartLine[] | null; postcode?: string | null }) {
    if (!apply(q)) return;
    navigate("/checkout");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="es-kicker">Account</p>
          <h1 className="mt-2 text-3xl font-medium">Quotes</h1>
        </div>
        <Button asChild variant="outline">
          <Link to="/app/build">New build</Link>
        </Button>
      </div>
      <ul className="space-y-3">
        {quotes.data?.length ? (
          quotes.data.map((q) => (
            <li key={q.id} className="es-card p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{q.id}</p>
                <p className="tabular-nums">{aud(q.total_ex_gst)} + GST</p>
              </div>
              <p className="mt-1 text-sm text-muted">
                {q.title} · {q.status} · {q.check_ok ? "compatible" : "needs a fix"}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => load(q as { id: string; lines?: CartLine[]; postcode?: string })}>
                  Load into builder
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => checkout(q as { id: string; lines?: CartLine[]; postcode?: string })}
                >
                  Checkout
                </Button>
              </div>
            </li>
          ))
        ) : (
          <li className="text-sm text-muted">Nothing saved yet.</li>
        )}
      </ul>
    </div>
  );
}
