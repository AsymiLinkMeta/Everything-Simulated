import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Trash2, Upload } from "lucide-react";
import { toast } from "@/lib/toast";
import { getProfile } from "@/lib/es/server";
import { fetchProducts } from "@/lib/es/product-cache";
import { fetchBuilderData, staffDeleteLayer, staffListLayers, staffSaveLayer, staffSetBadge } from "@/lib/es/builder";
import { BADGE_LABELS, BUILDER_STEPS, type BuilderBadge } from "@/lib/es/builder-core";
import { uploadProductImage } from "@/lib/es/product-images";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/staff/builder")({
  component: StaffBuilder,
});

const CATEGORIES = BUILDER_STEPS.flatMap((s) => s.categories);

function StaffBuilder() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["profile"], queryFn: () => getProfile() });
  const products = useQuery({ queryKey: ["products"], queryFn: () => fetchProducts() });
  const data = useQuery({ queryKey: ["builder-data"], queryFn: fetchBuilderData });
  const layers = useQuery({ queryKey: ["builder-layers"], queryFn: staffListLayers, enabled: Boolean(me.data?.isStaff) });
  const [step, setStep] = useState(BUILDER_STEPS[0].id);
  const [form, setForm] = useState({ category: "chassis", sku: "", image_url: "", z: "0", label: "" });
  const [busy, setBusy] = useState(false);

  const inStep = useMemo(() => {
    const cats = BUILDER_STEPS.find((s) => s.id === step)?.categories as string[];
    return (products.data ?? []).filter((p) => cats.includes(p.category));
  }, [products.data, step]);

  if (me.data && !me.data.isStaff) return <p className="text-sm text-muted">Staff only.</p>;

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["builder-data"] });
    await qc.invalidateQueries({ queryKey: ["builder-layers"] });
  }

  async function setBadge(sku: string, badge: string) {
    try {
      await staffSetBadge(sku, badge || null);
      toast.success(badge ? `Badge set: ${BADGE_LABELS[badge as BuilderBadge]}` : "Badge removed");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not set badge");
    }
  }

  async function upload(file: File) {
    if (!/^image\/(png|webp|jpeg)$/.test(file.type) || file.size > 5 * 1024 * 1024) {
      toast.error("Use a PNG or WebP (transparent background) up to 5 MB");
      return;
    }
    setBusy(true);
    try {
      const url = await uploadProductImage(file, "builder-layers");
      setForm((f) => ({ ...f, image_url: url }));
      toast.success("Layer image uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function addLayer() {
    setBusy(true);
    try {
      await staffSaveLayer({ category: form.category, sku: form.sku || null, image_url: form.image_url.trim(), z: Number(form.z) || 0, label: form.label.trim() || null });
      toast.success("Layer added");
      setForm((f) => ({ ...f, sku: "", image_url: "", label: "" }));
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add the layer");
    } finally {
      setBusy(false);
    }
  }

  const badges = data.data?.badges ?? {};
  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-medium">Rig builder</h1>
        <p className="mt-1 text-sm text-muted">Badges on the /build cards and the art for its rig preview. Nothing shows until you set it here.</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Badges</h2>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Builder step">
          {BUILDER_STEPS.map((s) => (
            <Button key={s.id} size="sm" variant={s.id === step ? "outline" : "subtle"} aria-pressed={s.id === step} onClick={() => setStep(s.id)}>
              {s.label}
            </Button>
          ))}
        </div>
        <div className="es-card divide-y divide-line">
          {inStep.length === 0 ? <p className="p-4 text-sm text-muted">No published parts in this step.</p> : null}
          {inStep.map((p) => (
            <label key={p.sku} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
              <span className="min-w-0">
                <span className="font-medium">{p.name}</span> <span className="text-muted">· {p.sku}</span>
              </span>
              <select
                aria-label={`Badge for ${p.name}`}
                className="min-h-11 rounded-md border border-line bg-surface px-3 text-sm text-paper"
                value={badges[p.sku] ?? ""}
                onChange={(e) => void setBadge(p.sku, e.target.value)}
              >
                <option value="">No badge</option>
                {Object.entries(BADGE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Preview layers</h2>
        <p className="text-sm text-muted">
          One transparent image per category (or per product, which wins). Same canvas size for every layer so they line up. Higher z sits on top.
        </p>
        <form
          className="es-card grid gap-3 p-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            void addLayer();
          }}
        >
          <label className="grid gap-1 text-sm">
            <span>Category</span>
            <select className="min-h-11 rounded-md border border-line bg-surface px-3 text-paper" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value, sku: "" })}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span>Product (optional)</span>
            <select className="min-h-11 rounded-md border border-line bg-surface px-3 text-paper" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })}>
              <option value="">Default for the category</option>
              {(products.data ?? [])
                .filter((p) => p.category === form.category)
                .map((p) => (
                  <option key={p.sku} value={p.sku}>
                    {p.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm sm:col-span-2">
            <span>Image</span>
            <div className="flex flex-wrap gap-2">
              <Input className="min-w-0 flex-1" placeholder="https://… or upload" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} required />
              <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-line px-3 text-sm">
                <Upload className="size-4" aria-hidden="true" /> {busy ? "Uploading…" : "Upload"}
                <input type="file" accept="image/png,image/webp,image/jpeg" hidden onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
              </label>
            </div>
          </label>
          <label className="grid gap-1 text-sm">
            <span>Stack order (z)</span>
            <Input type="number" min={-100} max={100} value={form.z} onChange={(e) => setForm({ ...form, z: e.target.value })} />
          </label>
          <label className="grid gap-1 text-sm">
            <span>Label (alt text)</span>
            <Input maxLength={80} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          </label>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={busy || !form.image_url.trim()}>
              Add layer
            </Button>
          </div>
        </form>
        <ul className="es-card divide-y divide-line">
          {(layers.data ?? []).length === 0 ? <li className="p-4 text-sm text-muted">No layers yet: /build shows the outline drawing.</li> : null}
          {(layers.data ?? []).map((l) => (
            <li key={l.id} className="flex items-center gap-3 p-3 text-sm">
              <img src={l.image_url} alt="" className="size-14 rounded bg-black object-contain" />
              <span className="min-w-0 flex-1">
                <span className="font-medium">{l.label || l.category}</span>
                <span className="block text-xs text-muted">
                  {l.sku ? `Product ${l.sku}` : `Default for ${l.category}`} · z {l.z}
                </span>
              </span>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Delete layer ${l.label || l.category}`}
                onClick={async () => {
                  try {
                    await staffDeleteLayer(l.id);
                    await refresh();
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Could not delete");
                  }
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
