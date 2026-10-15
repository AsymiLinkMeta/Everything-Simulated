import type { CSSProperties } from "react";
import { rigPartStates, type LayerRow } from "@/lib/es/builder-core";
import { RIG_DROP, RIG_GROUPS, RIG_SHADOW, RIG_VIEWBOX } from "./rig-art";
import { SiteImage } from "./site-image";

/**
 * The builder's rig preview: a generic aluminium-profile sim rig (see scripts/rig-art.ts).
 * Picked parts animate in at full strength, the rest stay as a faint ghost, and a motion
 * platform lifts the frame. Staff layer art in builder_layers replaces a category's drawing.
 */
export function RigPreview({ layers, picked, screens = 0 }: { layers: LayerRow[]; picked: Set<string>; screens?: number }) {
  const overridden = new Set(layers.map((l) => l.category));
  const states = rigPartStates(picked, screens, overridden);
  const parts = picked.size;
  const lift = states.motion === "on" ? 0 : RIG_DROP;
  const motion = RIG_GROUPS.filter((g) => g.part === "motion");
  const body = RIG_GROUPS.filter((g) => g.part !== "motion");
  const group = (g: (typeof RIG_GROUPS)[number], i: number) =>
    states[g.part] === "off" ? null : (
      <g key={i} className={`es-rp-g ${states[g.part] === "on" ? "is-on" : "is-ghost"}`} data-part={g.part} data-state={states[g.part]} dangerouslySetInnerHTML={{ __html: g.html }} />
    );
  return (
    <figure className="es-rb-preview" data-testid="rig-preview" data-mode={layers.length ? "layers" : "fallback"}>
      <svg viewBox={RIG_VIEWBOX} role="img" aria-label={`Rig preview, ${parts} part${parts === 1 ? "" : "s"} picked`} style={{ "--rp-lift": `${lift}px` } as CSSProperties}>
        <defs>
          <linearGradient id="rp-screen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1d2738" />
            <stop offset="0.55" stopColor="#0c1019" />
            <stop offset="1" stopColor="#3a0a07" />
          </linearGradient>
          <linearGradient id="rp-glass" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#1a1c22" />
            <stop offset="0.65" stopColor="#2c0705" />
            <stop offset="1" stopColor="#6a0c06" />
          </linearGradient>
          <filter id="rp-blur" x="-20%" y="-50%" width="140%" height="200%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
        </defs>
        <g className="es-rp-shadow" dangerouslySetInnerHTML={{ __html: RIG_SHADOW }} />
        {motion.map(group)}
        <g className="es-rp-lift">{body.map((g, i) => group(g, i + motion.length))}</g>
      </svg>
      {layers.map((l) => (
        <SiteImage key={`${l.category}-${l.sku ?? "default"}`} src={l.image_url} alt={l.label ?? ""} className="es-rb-layer" sizes="(min-width: 1024px) 40vw, 100vw" />
      ))}
      <figcaption className="es-rb-preview-note">{parts ? "Illustration. Parts appear as you pick them." : "Illustration. Pick parts and they appear here."}</figcaption>
    </figure>
  );
}
