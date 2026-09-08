import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Boxes, Sparkles, Trash2, X } from "lucide-react";
import { fetchProducts, invalidateProductCache } from "@/lib/es/product-cache";
import {
  staffDeleteCatalogProduct,
  staffListCatalogProducts,
  staffListOverrides,
  staffOverridePrice,
  staffSaveCatalogProduct,
} from "@/lib/es/server";
import type { ProductListing } from "@/lib/es/product-listing";
import { generateProductListing } from "@/lib/es/product-listing";
import { aud } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/staff/catalog")({
  component: Catalog,
});

const CATEGORIES = [
  "chassis",
  "wheelbase",
  "wheel",
  "pedals",
  "shifter",
  "handbrake",
  "seat",
  "motion",
  "monitor",
  "mount",
  "pc",
  "audio",
  "headset",
  "software",
  "adapter",
  "accessory",
] as const;

type Draft = {
  brand: string;
  productName: string;
  category: string;
  price: string;
  details: string;
  url: string;
};

const EMPTY_DRAFT: Draft = {
  brand: "",
  productName: "",
  category: "accessory",
  price: "",
  details: "",
  url: "",
};

async function compressImage(file: File): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const max = 1280;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.72);
  } catch {
    return null;
  }
}

function Catalog() {
  const qc = useQueryClient();
  const overrides = useQuery({ queryKey: ["overrides"], queryFn: () => staffListOverrides() });
  const customProducts = useQuery({
    queryKey: ["catalog-products"],
    queryFn: () => staffListCatalogProducts(),
  });
  const allProducts = useQuery({ queryKey: ["products"], queryFn: () => fetchProducts() });
  const map = Object.fromEntries((overrides.data ?? []).map((o) => [o.sku, o.sell_ex_gst]));
  const [priceDraft, setPriceDraft] = useState<Record<string, string>>({});

  const [showGenerator, setShowGenerator] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<{ listing: ProductListing; source: "grok" | "draft" } | null>(null);
  const [editListing, setEditListing] = useState<ProductListing | null>(null);
  const [saving, setSaving] = useState(false);

  async function savePrice(sku: string) {
    const dollars = Number(priceDraft[sku]);
    if (!Number.isFinite(dollars)) return;
    try {
      await staffOverridePrice({ sku, sellExGst: Math.round(dollars * 100) });
      toast.success(`${sku} updated`);
      await qc.invalidateQueries({ queryKey: ["overrides"] });
    } catch {
      toast.error("Could not save price");
    }
  }

  async function handleGenerate() {
    if (!draft.brand.trim() || !draft.productName.trim()) {
      toast.error("Brand and product name are required");
      return;
    }
    setGenerating(true);
    try {
      const result = await generateProductListing(draft);
      setGenerated(result);
      setEditListing(result.listing);
    } catch {
      toast.error("Could not generate a listing");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveListing() {
    if (!editListing) return;
    setSaving(true);
    try {
      await staffSaveCatalogProduct({
        sku: editListing.sku,
        brand: editListing.brand,
        name: editListing.name,
        category: editListing.category,
        sell_ex_gst: editListing.price,
        stock_status: editListing.stockStatus,
        lead_weeks_min: editListing.leadWeeksMin,
        lead_weeks_max: editListing.leadWeeksMax,
        description: editListing.description,
        notes: editListing.notes,
        image_url: editListing.imageUrl || editListing.images?.[0] || null,
        images: editListing.images ?? (editListing.imageUrl ? [editListing.imageUrl] : []),
        manufacturer_url: editListing.manufacturerUrl || null,
      });
      toast.success(`${editListing.sku} saved to catalogue`);
      invalidateProductCache();
      await qc.invalidateQueries({ queryKey: ["catalog-products"] });
      await qc.invalidateQueries({ queryKey: ["products"] });
      resetGenerator();
    } catch {
      toast.error("Could not save listing");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, sku: string) {
    try {
      await staffDeleteCatalogProduct(id);
      toast.success(`${sku} removed`);
      invalidateProductCache();
      await qc.invalidateQueries({ queryKey: ["catalog-products"] });
      await qc.invalidateQueries({ queryKey: ["products"] });
    } catch {
      toast.error("Could not delete listing");
    }
  }

  function resetGenerator() {
    setDraft(EMPTY_DRAFT);
    setGenerated(null);
    setEditListing(null);
    setShowGenerator(false);
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="es-kicker">Sales</p>
        <h1 className="mt-2 text-3xl font-medium">Catalogue & prices</h1>
        <p className="mt-2 text-sm text-muted">
          Generate new product listings, manage saved SKUs, and override prices. All prices AUD ex GST.
        </p>
      </div>

      {/* ---- Product generator ---- */}
      <section className="es-card p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-esred" />
            <h2 className="text-base font-medium">Product listing generator</h2>
          </div>
          <Button size="sm" variant={showGenerator ? "ghost" : "primary"} onClick={() => setShowGenerator((v) => !v)}>
            {showGenerator ? "Cancel" : "New product"}
          </Button>
        </div>

        {showGenerator && !editListing && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs text-muted">Brand</span>
              <Input
                value={draft.brand}
                onChange={(e) => setDraft((d) => ({ ...d, brand: e.target.value }))}
                placeholder="e.g. Simagic"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted">Product name</span>
              <Input
                value={draft.productName}
                onChange={(e) => setDraft((d) => ({ ...d, productName: e.target.value }))}
                placeholder="e.g. P1000 Pedals"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted">Category</span>
              <select
                className="es-input"
                value={draft.category}
                onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted">Indicative price (AUD ex GST)</span>
              <Input
                type="number"
                value={draft.price}
                onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
                placeholder="e.g. 599"
              />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs text-muted">Manufacturer URL (optional — AI reads the page)</span>
              <Input
                value={draft.url}
                onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
                placeholder="https://…"
              />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs text-muted">Extra details for the listing</span>
              <textarea
                className="es-input min-h-20 resize-y"
                value={draft.details}
                onChange={(e) => setDraft((d) => ({ ...d, details: e.target.value }))}
                placeholder="Load cell, USB-C, included mounts, etc."
              />
            </label>
            <div className="sm:col-span-2">
              <Button onClick={handleGenerate} disabled={generating}>
                <Sparkles className="size-4" />
                {generating ? "Generating…" : "Generate listing"}
              </Button>
            </div>
          </div>
        )}

        {editListing && (
          <div className="mt-4 space-y-4">
            {generated && (
              <p className="text-xs text-muted">
                {generated.source === "grok"
                  ? "Draft generated by Grok — review every field before saving."
                  : "Draft generated locally (no API key configured) — review and edit before saving."}
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs text-muted">SKU</span>
                <Input
                  value={editListing.sku}
                  onChange={(e) => setEditListing((l) => ({ ...l!, sku: e.target.value }))}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted">Brand</span>
                <Input
                  value={editListing.brand}
                  onChange={(e) => setEditListing((l) => ({ ...l!, brand: e.target.value }))}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted">Product name</span>
                <Input
                  value={editListing.name}
                  onChange={(e) => setEditListing((l) => ({ ...l!, name: e.target.value }))}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted">Category</span>
                <select
                  className="es-input"
                  value={editListing.category}
                  onChange={(e) => setEditListing((l) => ({ ...l!, category: e.target.value }))}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted">Price (AUD ex GST, cents)</span>
                <Input
                  type="number"
                  value={editListing.price}
                  onChange={(e) => setEditListing((l) => ({ ...l!, price: Math.max(0, Number(e.target.value)) }))}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted">Stock status</span>
                <select
                  className="es-input"
                  value={editListing.stockStatus}
                  onChange={(e) =>
                    setEditListing((l) => ({ ...l!, stockStatus: e.target.value as ProductListing["stockStatus"] }))
                  }
                >
                  <option value="stock">In stock</option>
                  <option value="indent">Indent</option>
                  <option value="discontinued">Discontinued</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted">Lead time min (weeks)</span>
                <Input
                  type="number"
                  value={editListing.leadWeeksMin}
                  onChange={(e) =>
                    setEditListing((l) => ({ ...l!, leadWeeksMin: Math.max(0, Number(e.target.value)) }))
                  }
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted">Lead time max (weeks)</span>
                <Input
                  type="number"
                  value={editListing.leadWeeksMax}
                  onChange={(e) =>
                    setEditListing((l) => ({
                      ...l!,
                      leadWeeksMax: Math.max(editListing.leadWeeksMin, Number(e.target.value)),
                    }))
                  }
                />
              </label>
              <label className="space-y-1 sm:col-span-2">
                <span className="text-xs text-muted">Customer-facing description</span>
                <textarea
                  className="es-input min-h-20 resize-y"
                  value={editListing.description}
                  onChange={(e) => setEditListing((l) => ({ ...l!, description: e.target.value }))}
                />
              </label>
              <label className="space-y-1 sm:col-span-2">
                <span className="text-xs text-muted">Internal notes (staff only)</span>
                <textarea
                  className="es-input min-h-16 resize-y"
                  value={editListing.notes}
                  onChange={(e) => setEditListing((l) => ({ ...l!, notes: e.target.value }))}
                />
              </label>
              <label className="space-y-1 sm:col-span-2">
                <span className="text-xs text-muted">Upload photos</span>
                <input
                  className="es-input"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={async (e) => {
                    const files = Array.from(e.target.files ?? []).slice(0, 8);
                    const urls: string[] = [];
                    for (const file of files) {
                      const data = await compressImage(file);
                      if (data) urls.push(data);
                    }
                    if (!urls.length) return;
                    setEditListing((l) => {
                      const next = [...(l?.images ?? []), ...urls].slice(0, 8);
                      return { ...l!, images: next, imageUrl: l?.imageUrl || next[0] };
                    });
                    e.target.value = "";
                  }}
                />
              </label>
                <Input
                  value={editListing.imageUrl ?? ""}
                  onChange={(e) => setEditListing((l) => ({ ...l!, imageUrl: e.target.value }))}
                  placeholder="https://…"
                />
              </label>
              <label className="space-y-1 sm:col-span-2">
                <span className="text-xs text-muted">Gallery URLs (one per line)</span>
                <textarea
                  className="es-input min-h-16 resize-y"
                  value={(editListing.images ?? []).join("\n")}
                  onChange={(e) =>
                    setEditListing((l) => ({
                      ...l!,
                      images: e.target.value
                        .split("\n")
                        .map((s) => s.trim())
                        .filter(Boolean)
                        .slice(0, 8),
                    }))
                  }
                />
              </label>
              {(editListing.images ?? []).length || editListing.imageUrl ? (
                <div className="es-gallery sm:col-span-2">
                  {(editListing.images?.length ? editListing.images : editListing.imageUrl ? [editListing.imageUrl] : []).map((src) => (
                    <div key={src} className="es-gallery-item">
                      <img src={src} alt="" />
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSaveListing} disabled={saving}>
                {saving ? "Saving…" : "Save to catalogue"}
              </Button>
              <Button variant="ghost" onClick={resetGenerator}>
                <X className="size-4" />
                Discard
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* ---- Saved custom products ---- */}
      <section>
        <div className="flex items-center gap-2">
          <Boxes className="size-4 text-muted" />
          <h2 className="text-lg font-medium">Saved listings</h2>
        </div>
        {customProducts.isPending ? (
          <p className="mt-3 text-sm text-muted">Loading…</p>
        ) : !customProducts.data?.length ? (
          <div className="mt-3 es-card p-6 text-center">
            <Boxes className="mx-auto size-5 text-muted" />
            <p className="mt-2 text-sm text-muted">No custom products yet. Use the generator above to create one.</p>
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted">
                <tr>
                  <th className="py-2">SKU</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {customProducts.data.map((p) => (
                  <tr key={p.id} className="border-t border-line">
                    <td className="py-3 font-medium">{p.sku}</td>
                    <td>
                      {p.brand} {p.name}
                    </td>
                    <td className="capitalize">{p.category}</td>
                    <td className="tabular-nums">{aud(p.sell_ex_gst)}</td>
                    <td className="capitalize">{p.stock_status}</td>
                    <td>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(p.id, p.sku)}
                        className="text-muted hover:text-esred"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ---- Static catalogue price overrides ---- */}
      <section>
        <h2 className="text-lg font-medium">Price overrides</h2>
        <p className="mt-1 text-sm text-muted">Adjust prices for existing catalogue SKUs. Compatibility rules stay in code.</p>
        <div className="mt-3 overflow-x-auto">
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
              {(allProducts.data ?? []).map((p) => (
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
                      value={priceDraft[p.sku] ?? ""}
                      onChange={(e) => setPriceDraft((d) => ({ ...d, [p.sku]: e.target.value }))}
                    />
                  </td>
                  <td>
                    <Button size="sm" variant="outline" onClick={() => savePrice(p.sku)}>
                      Save
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
