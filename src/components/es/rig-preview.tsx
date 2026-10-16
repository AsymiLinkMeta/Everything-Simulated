import { useEffect, useRef, useState, type CSSProperties } from "react";
import { RIG_PARTS, rigPartsFor, rigView, type LayerRow, type RigPart } from "@/lib/es/builder-core";
import { RIG_PART_VARIANTS, RIG_PARTS_BASE, RIG_PARTS_SIZE } from "./rig-parts";
import { SiteImage } from "./site-image";

const ADD_MS = 1800;
const PART_LABEL: Record<RigPart, string> = {
  chassis: "chassis",
  motion: "motion platform",
  mount: "screen stand",
  screens: "screens",
  pc: "PC",
  seat: "seat",
  pedals: "pedals",
  wheelbase: "wheelbase",
  wheel: "wheel",
  sidemount: "side mount",
  shifter: "shifter",
  handbrake: "handbrake",
  headset: "VR headset",
};

function pct(v: number, of: number) {
  return `${(v / of) * 100}%`;
}

/** A photoreal part cut out of the studio render; fades up from the ghost once it has loaded. */
function LitImage({ src }: { src: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <img
      ref={(img) => {
        if (img?.complete && img.naturalWidth && !loaded) setLoaded(true);
      }}
      src={src}
      alt=""
      className="es-rp-lit"
      data-loaded={loaded || undefined}
      decoding="async"
      onLoad={() => setLoaded(true)}
    />
  );
}

/**
 * The builder's rig preview. The complete rig (a generic, Everything Simulated branded profile rig
 * rendered in Blender, see scripts/rig3d) is always shown as a see-through ghost with every part
 * outlined; each part the build has lights up in full studio photo quality, with a red glow that
 * pulses when it is added and settles to a thin red rim. Hovering or focusing an option outlines the
 * part it would add. One render per screen layout; the parts are cut out of it with their render
 * masks, so they line up exactly. Only the ghost loads up front; part images load as parts are added.
 * Staff layer art in builder_layers is drawn on top and keeps its category ghosted.
 */
export function RigPreview({ layers, picked, screens = 0, highlight = null }: { layers: LayerRow[]; picked: Set<string>; screens?: number; highlight?: string | null }) {
  const overridden = new Set(layers.map((l) => l.category));
  const view = rigView(picked, screens, overridden);
  const variant = RIG_PART_VARIANTS[view.variant];
  const lit = new Set(view.lit);
  const hover = new Set(rigPartsFor(highlight));

  // ghost cross-fade: the last layout's ghost stays up until the new one has loaded
  const [shown, setShown] = useState(view.variant);
  const last = shown !== view.variant ? RIG_PART_VARIANTS[shown] : null;

  // parts lit since the last render pulse red for a moment (not on first load)
  const prev = useRef<Set<RigPart> | null>(null);
  const [adding, setAdding] = useState<Set<RigPart>>(new Set());
  const litKey = view.lit.join(" ");
  useEffect(() => {
    const now = new Set(litKey ? (litKey.split(" ") as RigPart[]) : []);
    const before = prev.current;
    prev.current = now;
    if (!before) return;
    const added = [...now].filter((p) => !before.has(p));
    if (!added.length) return;
    setAdding((a) => new Set([...a, ...added]));
    const t = window.setTimeout(() => setAdding((a) => new Set([...a].filter((p) => !added.includes(p)))), ADD_MS);
    return () => window.clearTimeout(t);
  }, [litKey]);

  // warm the outline masks for this layout once the ghost is up, so hover highlights are instant
  useEffect(() => {
    if (shown !== view.variant) return;
    const idle = (window as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 400));
    idle(() => {
      for (const f of Object.values(variant.parts)) if (f) new Image().src = RIG_PARTS_BASE + f.edge;
    });
  }, [shown, view.variant, variant]);

  const { width: W, height: H } = RIG_PARTS_SIZE;
  const names = view.lit.filter((p) => p !== "sidemount" || !(lit.has("shifter") || lit.has("handbrake"))).map((p) => PART_LABEL[p]);
  return (
    <figure
      className="es-rb-preview"
      data-testid="rig-preview"
      data-mode={layers.length ? "layers" : "rendered"}
      data-variant={view.variant}
      data-lit={litKey || undefined}
      data-empty={view.empty || undefined}
    >
      <div
        className="es-rp-stage"
        role="img"
        aria-label={names.length ? `Rig preview: ${names.join(", ")} highlighted on the full rig` : "Rig preview: the full rig in outline. Parts light up as you pick them."}
        style={{ aspectRatio: `${W} / ${H}` }}
      >
        {last ? <img key={`last-${shown}`} src={RIG_PARTS_BASE + last.ghost} alt="" className="es-rp-ghost is-last" /> : null}
        <img
          key={view.variant}
          src={RIG_PARTS_BASE + variant.ghost}
          alt=""
          className="es-rp-ghost"
          data-part="ghost"
          data-variant={view.variant}
          decoding="async"
          fetchPriority="high"
          onLoad={() => setShown(view.variant)}
        />
        {RIG_PARTS.map((p) => {
          const f = variant.parts[p];
          if (!f || !(lit.has(p) || hover.has(p))) return null;
          const [x, y, w, h] = f.box;
          const style: CSSProperties = { left: pct(x, W), top: pct(y, H), width: pct(w, W), height: pct(h, H) };
          const edge = `url("${RIG_PARTS_BASE + f.edge}")`;
          const cls = ["es-rp-part", lit.has(p) && "is-lit", adding.has(p) && "is-adding", hover.has(p) && "is-hover"].filter(Boolean).join(" ");
          return (
            <div key={`${view.variant}-${p}`} className={cls} style={style} data-part={p} data-state={lit.has(p) ? "lit" : "ghost"}>
              {lit.has(p) ? <LitImage src={RIG_PARTS_BASE + f.lit} /> : null}
              <span className="es-rp-glow" aria-hidden="true">
                <span className="es-rp-edge" style={{ maskImage: edge, WebkitMaskImage: edge }} />
              </span>
            </div>
          );
        })}
        {layers.map((l) => (
          <SiteImage key={`${l.category}-${l.sku ?? "default"}`} src={l.image_url} alt={l.label ?? ""} className="es-rb-layer" sizes="(min-width: 1280px) 440px, (min-width: 1024px) 380px, 100vw" />
        ))}
      </div>
      <figcaption className="es-rb-preview-note">
        {view.empty ? "The full rig in outline. Pick parts and they light up here." : "Your picks light up on the rig. Hover an option to see where it goes."}
      </figcaption>
    </figure>
  );
}
