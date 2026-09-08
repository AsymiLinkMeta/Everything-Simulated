import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { fetchRules, staffDeleteRule, staffSaveRule } from "@/lib/es/rules";
import { fetchProducts, invalidateProductCache } from "@/lib/es/product-cache";
import type { Severity } from "@/lib/es/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/staff/rules")({
  component: Rules,
});

const SEVERITIES: Severity[] = ["allow", "adapter", "warn", "block"];

function Rules() {
  const qc = useQueryClient();
  const rules = useQuery({ queryKey: ["compat-rules"], queryFn: fetchRules });
  const products = useQuery({ queryKey: ["products"], queryFn: () => fetchProducts() });
  const [form, setForm] = useState({ id: "", left: "", right: "", severity: "warn" as Severity, reason: "", adapterSku: "" });

  async function save() {
    if (!form.left || !form.right || !form.reason.trim()) {
      toast.error("Left SKU, right SKU and reason are required");
      return;
    }
    try {
      await staffSaveRule({
        id: form.id || `${form.left}-${form.right}`,
        left: form.left,
        right: form.right,
        severity: form.severity,
        reason: form.reason,
        adapterSku: form.adapterSku || undefined,
      });
      toast.success("Rule saved — checker uses it immediately");
      invalidateProductCache();
      await qc.invalidateQueries({ queryKey: ["compat-rules"] });
      await qc.invalidateQueries({ queryKey: ["products"] });
      setForm({ id: "", left: "", right: "", severity: "warn", reason: "", adapterSku: "" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save rule");
    }
  }

  const skus = (products.data ?? []).map((p) => p.sku);

  return (
    <div className="space-y-6">
      <div>
        <p className="es-kicker">Catalogue</p>
        <h1 className="mt-2 text-3xl font-medium">Compatibility rules</h1>
        <p className="mt-2 text-sm text-muted">
          Pairwise links the checker uses. Allow, warn, block, or require an adapter SKU. New listings stay unchecked until you add a rule.
        </p>
      </div>
      <section className="es-card grid gap-3 p-5 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs text-muted">Left SKU</span>
          <Input list="sku-list" value={form.left} onChange={(e) => setForm((f) => ({ ...f, left: e.target.value }))} />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted">Right SKU</span>
          <Input list="sku-list" value={form.right} onChange={(e) => setForm((f) => ({ ...f, right: e.target.value }))} />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted">Severity</span>
          <select className="es-input" value={form.severity} onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value as Severity }))}>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted">Adapter SKU (optional)</span>
          <Input list="sku-list" value={form.adapterSku} onChange={(e) => setForm((f) => ({ ...f, adapterSku: e.target.value }))} />
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className="text-xs text-muted">Reason (shown to the customer)</span>
          <Input value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
        </label>
        <div className="sm:col-span-2">
          <Button onClick={() => void save()}>Save rule</Button>
        </div>
        <datalist id="sku-list">
          {skus.map((sku) => (
            <option key={sku} value={sku} />
          ))}
        </datalist>
      </section>
      <ul className="space-y-2">
        {(rules.data ?? []).map((r) => (
          <li key={r.id} className="es-card flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-sm">
            <div>
              <p className="font-medium">
                {r.left} × {r.right} <span className="text-xs uppercase text-muted">{r.severity}</span>
              </p>
              <p className="text-muted">{r.reason}</p>
              {r.adapterSku ? <p className="text-xs text-muted">Adapter {r.adapterSku}</p> : null}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setForm({ id: r.id, left: r.left, right: r.right, severity: r.severity, reason: r.reason, adapterSku: r.adapterSku ?? "" })}
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  try {
                    await staffDeleteRule(r.id);
                    await qc.invalidateQueries({ queryKey: ["compat-rules"] });
                    invalidateProductCache();
                  } catch {
                    toast.error("Could not delete");
                  }
                }}
              >
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
