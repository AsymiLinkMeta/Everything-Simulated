import { useEffect, useRef, useCallback } from "react";
import QRCode from "qrcode";

export function QrCode({
  url,
  size = 160,
  className,
}: {
  url: string;
  size?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, url, {
      width: size,
      margin: 1,
      color: { dark: "#ffffffee", light: "#00000000" },
    });
  }, [url, size]);

  const download = useCallback(() => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `qr-${url.split("/").pop() || "code"}.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  }, [url]);

  return (
    <div className={className} style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <canvas ref={canvasRef} style={{ borderRadius: 8 }} />
      <button
        type="button"
        onClick={download}
        className="text-xs text-muted hover:text-paper"
        style={{ background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
      >
        Download QR
      </button>
    </div>
  );
}
