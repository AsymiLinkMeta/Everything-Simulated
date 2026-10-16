import { useEffect, useState } from "react";
import { BRAND_RED, brandedQrSvg, CARD_H, CARD_MM, CARD_W, jpegToPdf, QR_FONT_SRC, QR_LOGO_SRC } from "@/lib/es/branded-qr";

/** PNG export width; 2000 px is ~500 dpi across the 100 mm card. */
const EXPORT_W = 2000;

async function toDataUrl(src: string): Promise<string | null> {
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(typeof r.result === "string" ? r.result : null);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

let assets: Promise<{ logo: string | null; title: string | null; brand: string | null }> | null = null;
const loadAssets = () =>
  (assets ??= Promise.all([toDataUrl(QR_LOGO_SRC), toDataUrl(QR_FONT_SRC.title), toDataUrl(QR_FONT_SRC.brand)]).then(([logo, title, brand]) => ({ logo, title, brand })));

async function rasterise(svg: string, type: "image/png" | "image/jpeg"): Promise<Blob> {
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = EXPORT_W;
  canvas.height = Math.round((EXPORT_W * CARD_H) / CARD_W);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Export failed"))), type, 0.95));
}

function save(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/**
 * Branded, print-ready referral QR card for an ambassador (staff self-serve):
 * ES logo in the centre, error correction H, caption card, and PNG / SVG / PDF downloads.
 * Same artwork as `scripts/ambassador-qr.ts`.
 */
export function BrandedQrCard({ url, name, team, filename, width = 240 }: { url: string; name: string; team?: string | null; filename: string; width?: number }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setFailed(false);
    setSvg(null);
    Promise.all([import("qrcode"), loadAssets()])
      .then(([QR, a]) => brandedQrSvg(QR, { url, name, team, logoDataUrl: a.logo, fontTitleDataUrl: a.title, fontBrandDataUrl: a.brand }))
      .then((s) => live && setSvg(s))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [url, name, team]);

  async function download(kind: "png" | "svg" | "pdf") {
    if (!svg) return;
    setBusy(kind);
    try {
      if (kind === "svg") save(new Blob([svg], { type: "image/svg+xml" }), `${filename}.svg`);
      else if (kind === "png") save(await rasterise(svg, "image/png"), `${filename}.png`);
      else {
        const jpeg = new Uint8Array(await (await rasterise(svg, "image/jpeg")).arrayBuffer());
        const pdf = jpegToPdf(jpeg, { w: EXPORT_W, h: Math.round((EXPORT_W * CARD_H) / CARD_W) }, CARD_MM);
        save(new Blob([pdf], { type: "application/pdf" }), `${filename}.pdf`);
      }
    } finally {
      setBusy(null);
    }
  }

  const height = Math.round((width * CARD_H) / CARD_W);
  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      {failed ? (
        <p className="text-xs text-muted">QR code unavailable. Use the link instead.</p>
      ) : svg ? (
        <img
          src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
          alt={`Branded QR code for ${name}: ${url}`}
          data-testid="branded-qr"
          width={width}
          height={height}
          style={{ borderRadius: 10, background: "#fff", boxShadow: `0 0 0 1px ${BRAND_RED}33` }}
        />
      ) : (
        <div aria-hidden="true" className="animate-pulse rounded-lg bg-raised" style={{ width, height }} />
      )}
      <p className="max-w-xs break-all text-center text-xs text-muted">{url}</p>
      <div className="flex gap-3 text-xs">
        {(["png", "svg", "pdf"] as const).map((k) => (
          <button key={k} type="button" className="text-muted underline hover:text-paper" onClick={() => void download(k)} disabled={!svg || !!busy}>
            {busy === k ? "Preparing…" : `Download ${k.toUpperCase()}`}
          </button>
        ))}
      </div>
    </div>
  );
}
