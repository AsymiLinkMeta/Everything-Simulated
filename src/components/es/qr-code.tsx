import { useEffect, useState } from "react";

/**
 * Scannable QR code (dark on white with a quiet zone) using the `qrcode` library,
 * with PNG (1024 px, print-ready) and SVG downloads. The library is loaded on demand.
 */
export function QrCode({
  url,
  size = 160,
  className,
  filename,
  label = "QR code",
}: {
  url: string;
  size?: number;
  className?: string;
  filename?: string;
  label?: string;
}) {
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const base = filename || `qr-${url.replace(/^https?:\/\//, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 60) || "code"}`;

  useEffect(() => {
    let live = true;
    setFailed(false);
    import("qrcode")
      .then((QR) => QR.toString(url, { type: "svg", margin: 2, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } }))
      .then((s) => live && setSvg(s))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [url]);

  async function download(kind: "png" | "svg") {
    const QR = await import("qrcode");
    const a = document.createElement("a");
    a.download = `${base}.${kind}`;
    if (kind === "png") {
      a.href = await QR.toDataURL(url, { width: 1024, margin: 2, errorCorrectionLevel: "M" });
    } else {
      const text = svg ?? (await QR.toString(url, { type: "svg", margin: 2, errorCorrectionLevel: "M" }));
      a.href = URL.createObjectURL(new Blob([text], { type: "image/svg+xml" }));
    }
    a.click();
    if (kind === "svg") setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  return (
    <div className={className} style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      {failed ? (
        <p className="text-xs text-muted">QR code unavailable. Use the link instead.</p>
      ) : svg ? (
        <div
          role="img"
          aria-label={`${label}: ${url}`}
          data-testid="qr-code"
          style={{ width: size, height: size, borderRadius: 8, overflow: "hidden", background: "#fff" }}
          // Generated locally by the qrcode library from our own URL.
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <div aria-hidden="true" className="animate-pulse rounded-lg bg-raised" style={{ width: size, height: size }} />
      )}
      <div className="flex gap-3 text-xs">
        <button type="button" className="text-muted underline hover:text-paper" onClick={() => void download("png")} disabled={!svg}>
          Download PNG
        </button>
        <button type="button" className="text-muted underline hover:text-paper" onClick={() => void download("svg")} disabled={!svg}>
          Download SVG
        </button>
      </div>
    </div>
  );
}
