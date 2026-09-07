import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { PRODUCTS } from "@/lib/es/catalog";
import { staffListOverrides, staffOverridePrice } from "@/lib/es/server";
import { aud } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/staff/catalog")({
  component: Catalog,
});

function Catalog() {
  const qc = useQueryClient();
  const overrides = useQuery({ queryKey: ["overrides"], queryFn: () => staffListOverrides() });
  const map = Object.fromEntries((overrides.data ?? []).map((o) => [o.sku, o.sell_ex_gst]));
  const [draft, setDraft] = useState<Record<string, string>>({});

  async function save(sku: string) {
    const dollars = Number(draft[sku]);
    if (!Number.isFinite(dollars)) return;
    try {
      await staffOverridePrice({ data: { sku, sellExGst: Math.round(dollars * 100) } });
      toast.success(`${sku} updated`);
      await qc.invalidateQueries({ queryKey: ["overrides"] });
    } catch {
      toast.error("Could not save price");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="es-kicker">Sales</p>
        <h1 className="mt-2 text-3xl font-medium">Catalogue & prices</h1>
        <p className="mt-2 text-sm text-muted">Overrides are AUD ex GST. Compatibility rules stay in code.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="py-2">SKU</th>
              <th>Name</th>
              <th>List</th>
              <th>Override</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {PRODUCTS.map((p) => (
              <tr key={p.sku} className="border-t border-line">
                <td className="py-3 font-medium">{p.sku}</td>
                <td>
                  {p.brand} {p.name}
                </td>
                <td className="tabular-nums">{aud(p.sellExGst)}</td>
                <td>
                  <Input
                    className="max-w-28"
                    placeholder={map[p.sku] ? String((map[p.sku] ?? 0) / 100) : ""}
                    value={draft[p.sku] ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, [p.sku]: e.target.value }))}
                  />
                </td>
                <td>
                  <Button size="sm" variant="outline" onClick={() => save(p.sku)}>
                    Save
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
