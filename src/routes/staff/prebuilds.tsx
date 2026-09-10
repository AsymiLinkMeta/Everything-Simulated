import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Eraser,
  GripVertical,
  Package,
  Plus,
  Send,
  Sparkles,
  Star,
  StarOff,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Money } from "@/components/es/bits";
import { aud } from "@/lib/utils";
import { staffListCatalogProducts } from "@/lib/es/server";
import {
  staffListPrebuilds,
  staffSavePrebuild,
  staffDeletePrebuild,
  staffSetPrebuildComponents,
  staffReorderPrebuilds,
  staffToggleFeatured,
  generatePrebuildDraft,
} from "@/lib/es/prebuilds";
import type { PrebuildWithComponents } from "@/lib/es/prebuilds";
import type { CatalogProduct } from "@/lib/es/server";
import {
  compressImage,
  hasLightBackground,
  removeBackground,
} from "@/lib/es/image-utils";

export const Route = createFileRoute("/staff/prebuilds")({ component: PrebuildsEditor });

type DraftComponent = { sku: string; qty: number };

type DraftPrebuild = {
  id?: string;
  slug: string;
  name: string;
  kicker: string;
  blurb: string;
  description: string;
  image: string;
  price_ex_gst: number;
  highlights: string[];
  specs: Record<string, string>;
  capabilities: string[];
  featured: boolean;
  sort_order: number;
  status: string;
  components: DraftComponent[];
};

function emptyDraft(): DraftPrebuild {
  return {
    slug: "",
    name: "",
    kicker: "",
    blurb: "",
    description: "",
    image: "",
    price_ex_gst: 0,
    highlights: [],
    specs: {},
    capabilities: [],
    featured: false,
    sort_order: 0,
    status: "draft",
    components: [],
  };
}

function prebuildToDraft(p: PrebuildWithComponents): DraftPrebuild {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    kicker: p.kicker,
    blurb: p.blurb,
    description: p.description,
    image: p.image,
    price_ex_gst: p.price_ex_gst,
    highlights: p.highlights,
    specs: p.specs,
    capabilities: p.capabilities,
    featured: p.featured,
    sort_order: p.sort_order,
    status: p.status,
    components: p.components.map((c) => ({ sku: c.sku, qty: c.qty })),
  };
}

function PrebuildsEditor() {
  const qc = useQueryClient();
  const prebuilds = useQuery({ queryKey: ["staff-prebuilds"], queryFn: staffListPrebuilds });
  const catalog = useQuery({ queryKey: ["catalog-products"], queryFn: staffListCatalogProducts });

  const [editing, setEditing] = useState<DraftPrebuild | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const items = prebuilds.data ?? [];

  const handleSave = useCallback(async () => {
    if (!editing) return;
    if (!editing.name.trim() || !editing.slug.trim()) {
      toast.error("Name and slug are required");
      return;
    }
    setSaving(true);
    try {
      const result = await staffSavePrebuild({
        id: editing.id,
        slug: editing.slug,
        name: editing.name,
        kicker: editing.kicker,
        blurb: editing.blurb,
        description: editing.description,
        image: editing.image,
        price_ex_gst: editing.price_ex_gst,
        highlights: editing.highlights.filter(Boolean),
        specs: editing.specs,
        capabilities: editing.capabilities.filter(Boolean),
        featured: editing.featured,
        sort_order: editing.sort_order,
        status: editing.status,
      });
      if (editing.components.length || editing.id) {
        await staffSetPrebuildComponents(result.id, editing.components.filter((c) => c.sku));
      }
      toast.success("Prebuild saved");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["staff-prebuilds"] });
    } catch (err: unknown) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }, [editing, qc]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("Delete this prebuild?")) return;
    try {
      await staffDeletePrebuild(id);
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["staff-prebuilds"] });
    } catch (err: unknown) {
      toast.error((err as Error).message);
    }
  }, [qc]);

  const handleReorder = useCallback(async (id: string, dir: -1 | 1) => {
    const list = [...items];
    const idx = list.findIndex((p) => p.id === id);
    if (idx < 0) return;
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= list.length) return;
    [list[idx], list[swapIdx]] = [list[swapIdx], list[idx]];
    const ordered = list.map((p, i) => ({ id: p.id, sort_order: i }));
    try {
      await staffReorderPrebuilds(ordered);
      qc.invalidateQueries({ queryKey: ["staff-prebuilds"] });
    } catch (err: unknown) {
      toast.error((err as Error).message);
    }
  }, [items, qc]);

  const handleToggleFeatured = useCallback(async (id: string, featured: boolean) => {
    try {
      await staffToggleFeatured(id, featured);
      qc.invalidateQueries({ queryKey: ["staff-prebuilds"] });
    } catch (err: unknown) {
      toast.error((err as Error).message);
    }
  }, [qc]);

  if (editing) {
    return (
      <PrebuildForm
        draft={editing}
        setDraft={setEditing as (d: DraftPrebuild | null) => void}
        catalog={catalog.data ?? []}
        saving={saving}
        onSave={handleSave}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="es-kicker">Admin</p>
          <h1 className="mt-1 text-3xl font-medium">Prebuilt Simulators</h1>
          <p className="mt-2 text-sm text-muted">
            Create, edit and arrange prebuilt rig packages. Featured prebuilds appear on the homepage and the prebuilds page.
          </p>
        </div>
        <Button onClick={() => setEditing(emptyDraft())}>
          <Plus className="mr-1 size-4" /> New prebuild
        </Button>
      </div>

      {prebuilds.isPending ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-raised" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="es-card flex flex-col items-center gap-4 p-12 text-center">
          <Package className="size-10 text-muted" />
          <p className="text-muted">No prebuilds yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((p, idx) => (
            <div key={p.id} className="es-card flex items-center gap-3 p-4">
              <GripVertical className="size-4 shrink-0 text-muted" />
              <div className="flex shrink-0 flex-col gap-0.5">
                <button
                  type="button"
                  className="text-muted hover:text-paper disabled:opacity-30"
                  disabled={idx === 0}
                  onClick={() => handleReorder(p.id, -1)}
                  aria-label="Move up"
                >
                  <ArrowUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  className="text-muted hover:text-paper disabled:opacity-30"
                  disabled={idx === items.length - 1}
                  onClick={() => handleReorder(p.id, 1)}
                  aria-label="Move down"
                >
                  <ArrowDown className="size-3.5" />
                </button>
              </div>
              {p.image ? (
                <img src={p.image} alt="" className="size-14 shrink-0 rounded-lg object-cover" />
              ) : (
                <div className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-raised">
                  <Package className="size-6 text-muted" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-medium">{p.name || "Untitled"}</h3>
                  <span className={`rounded px-1.5 py-0.5 text-xs ${p.status === "published" ? "bg-ok/15 text-ok" : p.status === "archived" ? "bg-raised text-muted" : "bg-warn/15 text-warn"}`}>
                    {p.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted">
                  <span>{p.kicker || "No label"}</span>
                  <span><Money cents={p.price_ex_gst} gst /></span>
                  <span>{p.components.length} component{p.components.length !== 1 ? "s" : ""}</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  className={`rounded p-1.5 transition-colors ${p.featured ? "text-warn" : "text-muted hover:text-warn"}`}
                  onClick={() => handleToggleFeatured(p.id, !p.featured)}
                  title={p.featured ? "Remove from featured" : "Add to featured"}
                >
                  {p.featured ? <Star className="size-4 fill-current" /> : <StarOff className="size-4" />}
                </button>
                <button
                  type="button"
                  className="rounded p-1.5 text-muted hover:text-paper"
                  onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                  title="Toggle details"
                >
                  {expandedId === p.id ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                </button>
                <Button size="sm" variant="outline" onClick={() => setEditing(prebuildToDraft(p))}>
                  Edit
                </Button>
                <button
                  type="button"
                  className="rounded p-1.5 text-muted hover:text-esred"
                  onClick={() => handleDelete(p.id)}
                  title="Delete"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Prebuild editor form ----

function PrebuildForm({
  draft,
  setDraft,
  catalog,
  saving,
  onSave,
  onCancel,
}: {
  draft: DraftPrebuild;
  setDraft: (d: DraftPrebuild) => void;
  catalog: CatalogProduct[];
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [newSpecKey, setNewSpecKey] = useState("");
  const [newSpecVal, setNewSpecVal] = useState("");
  const [skuSearch, setSkuSearch] = useState("");

  // AI chat state
  const [aiInput, setAiInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMessages, setAiMessages] = useState<{ role: string; content: string }[]>([]);

  // Image uploader state
  const fileRef = useRef<HTMLInputElement>(null);
  const [imgBusy, setImgBusy] = useState(false);
  const [imgPreview, setImgPreview] = useState<string | null>(draft.image || null);
  const [imgHasBg, setImgHasBg] = useState(false);
  const [imgRemovedBg, setImgRemovedBg] = useState(false);
  const [imgBgRemoving, setImgBgRemoving] = useState(false);

  const set = <K extends keyof DraftPrebuild>(key: K, val: DraftPrebuild[K]) =>
    setDraft({ ...draft, [key]: val });

  const filteredCatalog = skuSearch.trim()
    ? catalog.filter(
        (c) =>
          c.sku.toLowerCase().includes(skuSearch.toLowerCase()) ||
          c.name.toLowerCase().includes(skuSearch.toLowerCase()) ||
          c.brand.toLowerCase().includes(skuSearch.toLowerCase()),
      )
    : catalog;

  const addComponent = (sku: string) => {
    if (draft.components.some((c) => c.sku === sku)) return;
    set("components", [...draft.components, { sku, qty: 1 }]);
  };

  const removeComponent = (sku: string) =>
    set("components", draft.components.filter((c) => c.sku !== sku));

  const setComponentQty = (sku: string, qty: number) =>
    set("components", draft.components.map((c) => (c.sku === sku ? { ...c, qty: Math.max(1, qty) } : c)));

  const moveComponent = (idx: number, dir: -1 | 1) => {
    const list = [...draft.components];
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= list.length) return;
    [list[idx], list[swapIdx]] = [list[swapIdx], list[idx]];
    set("components", list);
  };

  const catalogMap = new Map(catalog.map((c) => [c.sku, c]));
  const allSkus = catalog.map((c) => c.sku);

  // ---- AI chat helpers ----

  async function runAI(prompt: string) {
    if (aiBusy || !prompt.trim()) return;
    setAiBusy(true);
    setAiMessages((m) => [...m, { role: "user", content: prompt }]);
    try {
      const draft_result = await generatePrebuildDraft(prompt, allSkus);
      setAiMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: `Filled in: ${draft_result.name || "draft"}${draft_result.components.length ? ` with ${draft_result.components.length} components` : ""}. Review and edit below.`,
        },
      ]);
      // Merge AI draft into the form
      setDraft({
        ...draft,
        name: draft_result.name || draft.name,
        slug: draft_result.slug || draft.slug,
        kicker: draft_result.kicker || draft.kicker,
        blurb: draft_result.blurb || draft.blurb,
        description: draft_result.description || draft.description,
        price_ex_gst: draft_result.price_ex_gst || draft.price_ex_gst,
        highlights: draft_result.highlights?.length ? draft_result.highlights : draft.highlights,
        specs: draft_result.specs && Object.keys(draft_result.specs).length ? draft_result.specs : draft.specs,
        capabilities: draft_result.capabilities?.length ? draft_result.capabilities : draft.capabilities,
        components: draft_result.components?.length ? draft_result.components : draft.components,
      });
      toast.success("AI filled the form — review and edit below");
    } catch {
      setAiMessages((m) => [
        ...m,
        { role: "assistant", content: "Could not generate a draft. Try a more specific prompt or fill the form manually." },
      ]);
    } finally {
      setAiBusy(false);
    }
  }

  function sendAI(e: React.FormEvent) {
    e.preventDefault();
    if (!aiInput.trim() || aiBusy) return;
    const text = aiInput.trim();
    setAiInput("");
    void runAI(text);
  }

  // ---- Image uploader helpers ----

  async function handleImageFile(file: File) {
    setImgBusy(true);
    try {
      const compressed = await compressImage(file);
      const lightBg = await hasLightBackground(compressed);
      setImgPreview(compressed);
      setImgHasBg(lightBg);
      setImgRemovedBg(false);
      set("image", compressed);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not process that image");
    } finally {
      setImgBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleRemoveBg() {
    if (!imgPreview) return;
    setImgBgRemoving(true);
    try {
      const bgRemoved = await removeBackground(imgPreview);
      setImgPreview(bgRemoved);
      setImgRemovedBg(true);
      set("image", bgRemoved);
      toast.success("Background removed");
    } catch {
      toast.error("Background removal failed");
    } finally {
      setImgBgRemoving(false);
    }
  }

  function clearImage() {
    setImgPreview(null);
    setImgHasBg(false);
    setImgRemovedBg(false);
    set("image", "");
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium">{draft.id ? "Edit Prebuild" : "New Prebuild"}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={onSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
        </div>
      </div>

      {/* AI chat panel */}
      <section className="es-card space-y-4 p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-esred" />
          <h2 className="text-lg font-medium">AI Prebuild Generator</h2>
        </div>
        <p className="text-sm text-muted">
          Describe a rig and the AI will fill the entire form — name, description, specs, components and more.
        </p>
        {aiMessages.length > 0 && (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {aiMessages.map((m, i) => (
              <div
                key={i}
                className={`max-w-prose rounded-card px-4 py-3 text-sm ${m.role === "user" ? "ml-auto bg-raised" : "es-card"}`}
              >
                {m.content}
              </div>
            ))}
            {aiBusy && <p className="text-sm text-muted">Generating draft...</p>}
          </div>
        )}
        <form className="flex items-end gap-2" onSubmit={sendAI}>
          <Textarea
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            placeholder="e.g. Entry-level rig for juniors with Simagic Alpha Mini, Trak Racer TR80, single monitor, under $15k"
            rows={2}
            className="flex-1"
          />
          <Button type="submit" disabled={aiBusy} className="shrink-0">
            <Send className="size-4" /> {aiBusy ? "..." : "Generate"}
          </Button>
        </form>
        <div className="flex flex-wrap gap-2">
          {[
            "Starter rig with Simagic Alpha Mini and TR80",
            "Haptic rig with VNPX Active Pedals and haptic seat",
            "Motion rig with Exodus XR1 and SIMRIG SR2",
          ].map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="rounded-full border border-line px-3 py-1 text-xs text-muted transition-colors hover:bg-raised hover:text-paper disabled:opacity-50"
              disabled={aiBusy}
              onClick={() => void runAI(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      </section>

      {/* Basic info */}
      <section className="es-card space-y-4 p-5">
        <h2 className="text-lg font-medium">Basic Info</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm text-muted">
            Name
            <Input value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Starter Rig" />
          </label>
          <label className="space-y-1 text-sm text-muted">
            Slug (URL path)
            <Input
              value={draft.slug}
              onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
              placeholder="e.g. starter-rig"
            />
          </label>
          <label className="space-y-1 text-sm text-muted">
            Label badge
            <Input value={draft.kicker} onChange={(e) => set("kicker", e.target.value)} placeholder="e.g. Entry Level" />
          </label>
          <label className="space-y-1 text-sm text-muted">
            Price (cents ex GST)
            <Input
              type="number"
              value={draft.price_ex_gst}
              onChange={(e) => set("price_ex_gst", Number(e.target.value) || 0)}
            />
            <span className="text-xs">{aud(draft.price_ex_gst)} + GST</span>
          </label>
          <label className="space-y-1 text-sm text-muted">
            Status
            <select
              className="w-full rounded-md border border-line bg-ink px-3 py-2 text-sm text-paper"
              value={draft.status}
              onChange={(e) => set("status", e.target.value)}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </label>
        </div>
        <label className="block space-y-1 text-sm text-muted">
          Short description (card blurb)
          <textarea
            className="w-full rounded-md border border-line bg-ink px-3 py-2 text-sm text-paper"
            rows={2}
            value={draft.blurb}
            onChange={(e) => set("blurb", e.target.value)}
          />
        </label>
        <label className="block space-y-1 text-sm text-muted">
          Full description (detail page)
          <textarea
            className="w-full rounded-md border border-line bg-ink px-3 py-2 text-sm text-paper"
            rows={4}
            value={draft.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.featured}
            onChange={(e) => set("featured", e.target.checked)}
            className="size-4 rounded border-line"
          />
          Featured on homepage
        </label>
      </section>

      {/* Image uploader */}
      <section className="es-card space-y-4 p-5">
        <h2 className="text-lg font-medium">Prebuild Image</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={imgBusy}>
            <Upload className="size-4" /> {imgBusy ? "Processing..." : "Upload image"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) await handleImageFile(file);
            }}
          />
        </div>
        {imgPreview && (
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex size-32 items-center justify-center rounded-lg border border-line bg-raised p-2">
              <img src={imgPreview} alt="Prebuild preview" className="size-28 rounded object-cover" />
            </div>
            <div className="space-y-2">
              {imgHasBg && !imgRemovedBg && (
                <p className="text-xs text-yellow-400">
                  Light background detected — optional remove if you want a transparent PNG.
                </p>
              )}
              {imgRemovedBg && (
                <p className="text-xs text-green-400">Background removed. Original lighting is kept.</p>
              )}
              {!imgHasBg && !imgRemovedBg && (
                <p className="text-xs text-muted">Image looks ready. No charcoal fill or logo stamp is applied.</p>
              )}
              <div className="flex flex-wrap gap-2">
                {!imgRemovedBg && (
                  <Button variant="outline" size="sm" disabled={imgBgRemoving} onClick={handleRemoveBg}>
                    <Eraser className="size-4" /> {imgBgRemoving ? "Removing..." : "Remove background"}
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={clearImage} className="text-muted hover:text-esred">
                  <X className="size-4" /> Clear
                </Button>
              </div>
            </div>
          </div>
        )}
        <label className="block space-y-1 text-sm text-muted">
          Or paste an image URL
          <Input value={draft.image.startsWith("data:") ? "" : draft.image} onChange={(e) => { set("image", e.target.value); setImgPreview(e.target.value || null); setImgRemovedBg(false); setImgHasBg(false); }} placeholder="https://..." />
        </label>
      </section>

      {/* Components from catalog */}
      <section className="es-card space-y-4 p-5">
        <h2 className="text-lg font-medium">Components (from catalog)</h2>
        {draft.components.length > 0 && (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {draft.components.map((comp, idx) => {
              const cat = catalogMap.get(comp.sku);
              return (
                <li key={comp.sku} className="flex items-center gap-3 px-4 py-2 text-sm">
                  <div className="flex shrink-0 flex-col gap-0.5">
                    <button type="button" className="text-muted hover:text-paper disabled:opacity-30" disabled={idx === 0} onClick={() => moveComponent(idx, -1)}>
                      <ArrowUp className="size-3" />
                    </button>
                    <button type="button" className="text-muted hover:text-paper disabled:opacity-30" disabled={idx === draft.components.length - 1} onClick={() => moveComponent(idx, 1)}>
                      <ArrowDown className="size-3" />
                    </button>
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">{cat ? `${cat.brand} ${cat.name}` : comp.sku}</span>
                    {cat && <span className="ml-2 text-xs text-muted">{cat.sku} · {aud(cat.sell_ex_gst)}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted">
                      Qty
                      <Input
                        type="number"
                        min={1}
                        value={comp.qty}
                        onChange={(e) => setComponentQty(comp.sku, Number(e.target.value))}
                        className="ml-1 w-16"
                      />
                    </label>
                    <button type="button" onClick={() => removeComponent(comp.sku)} className="text-muted hover:text-esred">
                      <X className="size-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div>
          <Input
            placeholder="Search catalog products..."
            value={skuSearch}
            onChange={(e) => setSkuSearch(e.target.value)}
          />
          <div className="mt-2 max-h-[28rem] overflow-y-auto rounded-lg border border-line p-2">
            {filteredCatalog.length === 0 ? (
              <p className="px-2 py-1.5 text-sm text-muted">No products match</p>
            ) : (
              Array.from(
                filteredCatalog.reduce<Map<string, CatalogProduct[]>>((groups, product) => {
                  const category = product.category.trim() || "Uncategorised";
                  const group = groups.get(category) ?? [];
                  group.push(product);
                  groups.set(category, group);
                  return groups;
                }, new Map()),
              )
                .sort(([categoryA], [categoryB]) => categoryA.localeCompare(categoryB))
                .map(([category, products]) => (
                  <div key={category} className="not-first:mt-4">
                    <h3 className="border-b border-line px-2 pb-1.5 text-xs font-medium uppercase tracking-[0.16em] text-muted">
                      {category} <span className="normal-case tracking-normal">({products.length})</span>
                    </h3>
                    <ul className="divide-y divide-line">
                      {products
                        .sort((a, b) => `${a.brand} ${a.name}`.localeCompare(`${b.brand} ${b.name}`))
                        .map((c) => {
                          const already = draft.components.some((comp) => comp.sku === c.sku);
                          return (
                            <li key={c.sku} className="flex items-center justify-between gap-3 rounded px-2 py-2 text-sm hover:bg-raised">
                              <span className="min-w-0">
                                <span className="block truncate font-medium">{c.brand} {c.name}</span>
                                <span className="block text-xs text-muted">{c.sku} · {aud(c.sell_ex_gst)}</span>
                              </span>
                              <Button size="sm" variant="outline" disabled={already} onClick={() => addComponent(c.sku)}>
                                {already ? "Added" : "Add"}
                              </Button>
                            </li>
                          );
                        })}
                    </ul>
                  </div>
                ))
            )}
          </div>
        </div>
      </section>

      {/* Highlights */}
      <section className="es-card space-y-4 p-5">
        <h2 className="text-lg font-medium">Highlights</h2>
        {draft.highlights.map((h, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={h}
              onChange={(e) => {
                const list = [...draft.highlights];
                list[i] = e.target.value;
                set("highlights", list);
              }}
              placeholder="e.g. Gold Coast assembled"
            />
            <button type="button" onClick={() => set("highlights", draft.highlights.filter((_, j) => j !== i))} className="text-muted hover:text-esred">
              <X className="size-4" />
            </button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => set("highlights", [...draft.highlights, ""])}>
          <Plus className="mr-1 size-3" /> Add highlight
        </Button>
      </section>

      {/* Capabilities */}
      <section className="es-card space-y-4 p-5">
        <h2 className="text-lg font-medium">Capabilities</h2>
        {draft.capabilities.map((c, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={c}
              onChange={(e) => {
                const list = [...draft.capabilities];
                list[i] = e.target.value;
                set("capabilities", list);
              }}
              placeholder="e.g. Force feedback up to 12Nm"
            />
            <button type="button" onClick={() => set("capabilities", draft.capabilities.filter((_, j) => j !== i))} className="text-muted hover:text-esred">
              <X className="size-4" />
            </button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => set("capabilities", [...draft.capabilities, ""])}>
          <Plus className="mr-1 size-3" /> Add capability
        </Button>
      </section>

      {/* Specifications */}
      <section className="es-card space-y-4 p-5">
        <h2 className="text-lg font-medium">Specifications</h2>
        {Object.entries(draft.specs).map(([key, val]) => (
          <div key={key} className="flex items-center gap-2">
            <span className="w-32 shrink-0 text-sm font-medium">{key}</span>
            <Input
              value={val}
              onChange={(e) => set("specs", { ...draft.specs, [key]: e.target.value })}
            />
            <button
              type="button"
              onClick={() => {
                const s = { ...draft.specs };
                delete s[key];
                set("specs", s);
              }}
              className="text-muted hover:text-esred"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
        <div className="flex items-end gap-2">
          <label className="space-y-1 text-sm text-muted">
            Key
            <Input value={newSpecKey} onChange={(e) => setNewSpecKey(e.target.value)} placeholder="e.g. Max Torque" />
          </label>
          <label className="space-y-1 text-sm text-muted">
            Value
            <Input value={newSpecVal} onChange={(e) => setNewSpecVal(e.target.value)} placeholder="e.g. 12 Nm" />
          </label>
          <Button
            variant="outline"
            size="sm"
            disabled={!newSpecKey.trim()}
            onClick={() => {
              set("specs", { ...draft.specs, [newSpecKey.trim()]: newSpecVal });
              setNewSpecKey("");
              setNewSpecVal("");
            }}
          >
            <Plus className="mr-1 size-3" /> Add
          </Button>
        </div>
      </section>

      <div className="flex justify-end gap-2 pb-8">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={onSave} disabled={saving}>{saving ? "Saving..." : "Save Prebuild"}</Button>
      </div>
    </div>
  );
}
