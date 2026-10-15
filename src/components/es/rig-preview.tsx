import type { LayerRow } from "@/lib/es/builder-core";
import { SiteImage } from "./site-image";

/**
 * 2D rig preview. With layer art in builder_layers it stacks those images (z order);
 * without it, a drawn side-view silhouette lights up each part as it is picked.
 */
export function RigPreview({ layers, picked }: { layers: LayerRow[]; picked: Set<string> }) {
  if (layers.length) {
    return (
      <figure className="es-rb-preview" aria-label="Preview of your rig" data-testid="rig-preview" data-mode="layers">
        {layers.map((l) => (
          <SiteImage key={`${l.category}-${l.sku ?? "default"}`} src={l.image_url} alt={l.label ?? ""} className="es-rb-layer" sizes="(min-width: 1024px) 40vw, 100vw" />
        ))}
      </figure>
    );
  }
  const on = (cat: string | string[]) => ((Array.isArray(cat) ? cat : [cat]).some((c) => picked.has(c)) ? "is-on" : "");
  const parts = [...picked].length;
  return (
    <figure className="es-rb-preview" data-testid="rig-preview" data-mode="fallback">
      <svg viewBox="0 0 400 260" role="img" aria-label={`Rig outline, ${parts} part${parts === 1 ? "" : "s"} picked`}>
        <g className={`es-rb-part ${on("motion")}`} data-part="motion">
          <rect x="60" y="222" width="34" height="18" rx="3" />
          <rect x="290" y="222" width="34" height="18" rx="3" />
        </g>
        <g className={`es-rb-part ${on("chassis")}`} data-part="chassis">
          <path d="M40 214 H360 M70 214 V150 M300 214 V120 M70 150 H130 M240 120 H330" />
        </g>
        <g className={`es-rb-part ${on("seat")}`} data-part="seat">
          <path d="M80 206 C80 170 90 112 112 92 L132 98 C120 130 118 168 124 200 Z" />
          <path d="M120 200 H200 L196 188 H124" />
        </g>
        <g className={`es-rb-part ${on("pedals")}`} data-part="pedals">
          <path d="M306 206 L322 168 M320 206 L336 172 M334 206 L350 176" />
        </g>
        <g className={`es-rb-part ${on("wheelbase")}`} data-part="wheelbase">
          <rect x="238" y="96" width="46" height="28" rx="4" />
        </g>
        <g className={`es-rb-part ${on("wheel")}`} data-part="wheel">
          <ellipse cx="232" cy="110" rx="8" ry="30" />
        </g>
        <g className={`es-rb-part ${on(["monitor", "mount"])}`} data-part="display">
          <path d="M300 34 L360 22 V92 L300 98 Z" />
          <path d="M330 96 V120" />
        </g>
        <g className={`es-rb-part ${on("headset")}`} data-part="headset">
          <rect x="96" y="58" width="30" height="18" rx="7" />
        </g>
        <g className={`es-rb-part ${on("pc")}`} data-part="pc">
          <rect x="8" y="150" width="30" height="62" rx="3" />
        </g>
        <g className={`es-rb-part ${on(["shifter", "handbrake"])}`} data-part="extras">
          <path d="M214 196 V160 M214 160 m-5 0 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0" />
        </g>
      </svg>
      <figcaption className="es-rb-preview-note">Outline view. Parts light up as you pick them.</figcaption>
    </figure>
  );
}
