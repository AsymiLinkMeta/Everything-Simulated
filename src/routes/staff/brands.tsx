import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Aperture, Eraser, Link2, Plus, Trash2, Upload, X } from "lucide-react";
import { fetchBrands, staffCreateBrand, staffDeleteBrand, staffUpdateBrand } from "@/lib/es/brands";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/staff/brands")({
  component: BrandsAdmin,
});

type IconState =
  | { kind: "empty" }
  | { kind: "preview"; dataUrl: string; hasBg: boolean; outlined: boolean }
  | { kind: "removed"; dataUrl: string; outlined: boolean };

const LOGO_CANVAS = 440;

async function fileToCroppedLogo(file: File): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const srcW = bitmap.width;
    const srcH = bitmap.height;
    const target = LOGO_CANVAS;
    const scale = Math.min(target / srcW, target / srcH);
    const drawW = Math.max(1, Math.round(srcW * scale));
    const drawH = Math.max(1, Math.round(srcH * scale));
    const canvas = document.createElement("canvas");
    canvas.width = target;
    canvas.height = target;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.clearRect(0, 0, target, target);
    ctx.drawImage(bitmap, (target - drawW) / 2, (target - drawH) / 2, drawW, drawH);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

function hasLightBackground(dataUrl: string): boolean {
  return new Promise<boolean>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const w = 48;
      const h = 48;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(true);
      ctx.drawImage(img, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h).data;
      let lightCount = 0;
      const total = w * h;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        if (a < 10) continue;
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        if (brightness > 180) lightCount++;
      }
      resolve(lightCount > total * 0.25);
    };
    img.onerror = () => resolve(true);
    img.src = dataUrl;
  }) as unknown as boolean;
}

function removeBackground(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(dataUrl);
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imageData.data;
      const w = canvas.width;
      const h = canvas.height;
      const corners = [
        [0, 0],
        [w - 1, 0],
        [0, h - 1],
        [w - 1, h - 1],
      ];
      let bgR = 0;
      let bgG = 0;
      let bgB = 0;
      for (const [cx, cy] of corners) {
        const idx = (cy * w + cx) * 4;
        bgR += d[idx];
        bgG += d[idx + 1];
        bgB += d[idx + 2];
      }
      bgR /= corners.length;
      bgG /= corners.length;
      bgB /= corners.length;
      const threshold = 40;
      for (let i = 0; i < d.length; i += 4) {
        const dr = Math.abs(d[i] - bgR);
        const dg = Math.abs(d[i + 1] - bgG);
        const db = Math.abs(d[i + 2] - bgB);
        if (dr < threshold && dg < threshold && db < threshold) {
          d[i + 3] = 0;
        } else if (dr < threshold + 20 && dg < threshold + 20 && db < threshold + 20) {
          d[i + 3] = Math.round(d[i + 3] * 0.4);
        }
      }
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function addWhiteOutlineToBlack(dataUrl: string, radius = 2): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(dataUrl);
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imageData.data;
      const w = canvas.width;
      const h = canvas.height;
      const isBlack = new Uint8Array(w * h);
      for (let i = 0; i < w * h; i++) {
        const idx = i * 4;
        if (d[idx + 3] < 20) continue;
        const brightness = (d[idx] * 299 + d[idx + 1] * 587 + d[idx + 2] * 114) / 1000;
        if (brightness < 70) isBlack[i] = 1;
      }
      let changed = false;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          if (isBlack[i]) continue;
          const idx = i * 4;
          if (d[idx + 3] > 40) continue;
          let nearBlack = false;
          for (let dy = -radius; dy <= radius && !nearBlack; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
              if (isBlack[ny * w + nx]) { nearBlack = true; break; }
            }
          }
          if (nearBlack) {
            d[idx] = 255;
            d[idx + 1] = 255;
            d[idx + 2] = 255;
            d[idx + 3] = 255;
            changed = true;
          }
        }
      }
      if (!changed) { resolve(dataUrl); return; }
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function BrandsAdmin() {
  const qc = useQueryClient();
  const brands = useQuery({ queryKey: ["brands"], queryFn: () => fetchBrands() });
  const fileRef = useRef<HTMLInputElement>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [icon, setIcon] = useState<IconState>({ kind: "empty" });
  const [removing, setRemoving] = useState(false);
  const [outlining, setOutlining] = useState(false);
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [urlInput, setUrlInput] = useState("");

  async function handleFile(file: File) {
    const png = await fileToCroppedLogo(file);
    if (!png) {
      toast.error("Could not process that image");
      return;
    }
    const lightBg = await hasLightBackground(png);
    setIcon({ kind: "preview", dataUrl: png, hasBg: lightBg, outlined: false });
  }

  async function handleUrlImport() {
    const url = urlInput.trim();
    if (!url) return;
    setImporting(true);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Fetch failed");
      const blob = await res.blob();
      if (!blob.type.startsWith("image/")) {
        toast.error("That URL is not an image");
        return;
      }
      const file = new File([blob], "brand.png", { type: blob.type });
      await handleFile(file);
      toast.success("Image imported from URL");
    } catch {
      toast.error("Could not import from that URL");
    } finally {
      setImporting(false);
    }
  }

  async function handleRemoveBg() {
    if (icon.kind !== "preview" && icon.kind !== "removed") return;
    setRemoving(true);
    try {
      const bgRemoved = await removeBackground(icon.dataUrl);
      const outlined = await addWhiteOutlineToBlack(bgRemoved);
      const didOutline = outlined !== bgRemoved;
      setIcon({ kind: "removed", dataUrl: outlined, outlined: didOutline });
      toast.success(didOutline ? "Background removed & white outline added to black areas" : "Background removed");
    } catch {
      toast.error("Background removal failed");
    } finally {
      setRemoving(false);
    }
  }

  async function handleAddOutline() {
    if (icon.kind !== "preview" && icon.kind !== "removed") return;
    setOutlining(true);
    try {
      const outlined = await addWhiteOutlineToBlack(icon.dataUrl);
      const didOutline = outlined !== icon.dataUrl;
      if (icon.kind === "preview") {
        setIcon({ kind: "preview", dataUrl: outlined, hasBg: icon.hasBg, outlined: didOutline });
      } else {
        setIcon({ kind: "removed", dataUrl: outlined, outlined: didOutline });
      }
      toast.success(didOutline ? "White outline added to black areas" : "No black areas detected — no outline needed");
    } catch {
      toast.error("Could not add outline");
    } finally {
      setOutlining(false);
    }
  }

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Brand name is required");
      return;
    }
    setSaving(true);
    try {
      const iconUrl = icon.kind === "preview" || icon.kind === "removed" ? icon.dataUrl : null;
      await staffCreateBrand({ name: trimmed, iconUrl, linkUrl: linkUrl.trim() || null });
      toast.success(`${trimmed} added to brands`);
      resetForm();
      await qc.invalidateQueries({ queryKey: ["brands"] });
    } catch {
      toast.error("Could not save brand");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, brandName: string) {
    try {
      await staffDeleteBrand(id);
      toast.success(`${brandName} removed`);
      await qc.invalidateQueries({ queryKey: ["brands"] });
    } catch {
      toast.error("Could not delete brand");
    }
  }

  function resetForm() {
    setName("");
    setLinkUrl("");
    setIcon({ kind: "empty" });
    setUrlInput("");
    setShowAdd(false);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <p className="es-kicker">Showroom</p>
          <h1 className="mt-2 text-3xl font-medium">Brands</h1>
          <p className="mt-2 text-sm text-muted">
            Manage brand logos shown on the homepage banner. Upload, import from URL, and remove backgrounds — all in one place.
          </p>
        </div>
        <Button variant={showAdd ? "ghost" : "primary"} onClick={() => setShowAdd((v) => !v)}>
          {showAdd ? (
            <>
              <X className="size-4" /> Cancel
            </>
          ) : (
            <>
              <Plus className="size-4" /> Add brand
            </>
          )}
        </Button>
      </div>

      {showAdd && (
        <section className="es-card space-y-5 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs text-muted">Brand name</span>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Simagic" />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted">Link URL (optional)</span>
              <Input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://simagic.com"
              />
            </label>
          </div>

          {/* Icon section: uploader + URL import + bg remover */}
          <div className="space-y-3">
            <p className="text-xs text-muted">Brand icon (logo)</p>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="size-4" /> Upload image
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) await handleFile(file);
                  e.target.value = "";
                }}
              />
              <div className="flex items-center gap-1">
                <Input
                  className="max-w-56"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://…/logo.png"
                />
                <Button variant="outline" size="sm" disabled={importing || !urlInput.trim()} onClick={handleUrlImport}>
                  <Link2 className="size-4" /> {importing ? "…" : "Import"}
                </Button>
              </div>
            </div>

            {icon.kind !== "empty" && (
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex size-24 items-center justify-center rounded-lg border border-line bg-checker p-2">
                  <img src={icon.dataUrl} alt="Brand icon preview" className="size-20 object-contain" />
                </div>
                <p className="text-xs text-muted">Cropped to {LOGO_CANVAS}×{LOGO_CANVAS}px — fits the banner card.</p>
                <div className="space-y-1">
                  {icon.kind === "preview" && icon.hasBg && (
                    <p className="text-xs text-yellow-400">
                      Light background detected — removing it will produce a clean transparent logo.
                    </p>
                  )}
                  {icon.kind === "preview" && !icon.hasBg && !icon.outlined && (
                    <p className="text-xs text-muted">No light background detected — looks ready.</p>
                  )}
                  {icon.outlined && (
                    <p className="text-xs text-green-400">White outline added to black areas.</p>
                  )}
                  {icon.kind === "removed" && !icon.outlined && (
                    <p className="text-xs text-green-400">Background removed. Ready to save.</p>
                  )}
                  <div className="flex gap-2">
                    {icon.kind === "preview" && (
                      <Button variant="outline" size="sm" disabled={removing} onClick={handleRemoveBg}>
                        <Eraser className="size-4" /> {removing ? "Removing…" : "Remove background"}
                      </Button>
                    )}
                    {(icon.kind === "preview" || icon.kind === "removed") && !icon.outlined && (
                      <Button variant="outline" size="sm" disabled={outlining} onClick={handleAddOutline}>
                        <Aperture className="size-4" /> {outlining ? "Outlining…" : "Add white outline"}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIcon({ kind: "empty" })}
                      className="text-muted hover:text-esred"
                    >
                      <X className="size-4" /> Clear
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? "Saving…" : "Save brand"}
            </Button>
          </div>
        </section>
      )}

      {/* Saved brands list */}
      <section>
        <h2 className="text-lg font-medium">Saved brands</h2>
        {brands.isPending ? (
          <p className="mt-3 text-sm text-muted">Loading…</p>
        ) : !brands.data?.length ? (
          <div className="mt-3 es-card p-6 text-center">
            <p className="text-sm text-muted">No brands yet. Add one to show on the homepage banner.</p>
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted">
                <tr>
                  <th className="py-2">Logo</th>
                  <th>Name</th>
                  <th>Link</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {brands.data.map((b) => (
                  <tr key={b.id} className="border-t border-line">
                    <td className="py-3">
                      {b.icon_url ? (
                        <img src={b.icon_url} alt={b.name} className="size-10 rounded-md border border-line bg-checker object-contain p-1" />
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="font-medium">{b.name}</td>
                    <td>
                      {b.link_url ? (
                        <a
                          href={b.link_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted hover:text-paper hover:underline"
                        >
                          {b.link_url.replace(/^https?:\/\//, "").slice(0, 30)}
                        </a>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(b.id, b.name)}
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
    </div>
  );
}
