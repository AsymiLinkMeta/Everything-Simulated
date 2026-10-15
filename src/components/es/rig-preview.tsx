import { rigPartStates, type LayerRow } from "@/lib/es/builder-core";
import { RIG_PHOTO_BASE, RIG_PHOTO_FILES, RIG_PHOTO_ORDER, RIG_PHOTO_RAISED, RIG_PHOTO_SIZE } from "./rig-photo";
import { SiteImage } from "./site-image";

const file = (name: string) => RIG_PHOTO_BASE + RIG_PHOTO_FILES[name];

/**
 * The builder's rig preview: pre-rendered layers of a generic profile sim rig (Blender, see
 * scripts/rig3d), stacked back to front. Picked parts fade in at full strength, the rest stay as
 * a faint ghost, and a motion platform swaps the frame for its raised render. Staff layer art in
 * builder_layers replaces a category's render. An empty build loads one small ghosted image.
 */
export function RigPreview({ layers, picked, screens = 0 }: { layers: LayerRow[]; picked: Set<string>; screens?: number }) {
  const overridden = new Set(layers.map((l) => l.category));
  const states = rigPartStates(picked, screens, overridden);
  const raised = states.motion === "on";
  const anyOn = picked.size > 0;
  const parts = picked.size;
  const shadows = [
    states.chassis === "on" ? (raised ? "shadow-rig--raised" : "shadow-rig") : null,
    states.mount === "on" || states["screen-center"] === "on" || states["screen-dual"] === "on" ? "shadow-stand" : null,
    states.pc === "on" ? "shadow-pc" : null,
  ].filter((s): s is string => s !== null);
  return (
    <figure className="es-rb-preview" data-testid="rig-preview" data-mode={layers.length ? "layers" : "rendered"} data-raised={raised || undefined}>
      <div className="es-rp-stage" role="img" aria-label={`Rig preview, ${parts} part${parts === 1 ? "" : "s"} picked`} style={{ aspectRatio: `${RIG_PHOTO_SIZE.width} / ${RIG_PHOTO_SIZE.height}` }}>
        {anyOn ? (
          <>
            {shadows.map((s) => (
              <img key={s} src={file(s)} alt="" className="es-rp-shadow" decoding="async" />
            ))}
            {RIG_PHOTO_ORDER.map((part) => {
              const state = states[part];
              if (!state || state === "off") return null;
              const name = raised && RIG_PHOTO_RAISED.includes(part) ? `${part}--raised` : part;
              return <img key={name} src={file(name)} alt="" className={`es-rp-layer is-${state}`} data-part={part} data-state={state} decoding="async" />;
            })}
          </>
        ) : (
          <img src={file("ghost-empty")} alt="" className="es-rp-empty" data-part="ghost" />
        )}
        {layers.map((l) => (
          <SiteImage key={`${l.category}-${l.sku ?? "default"}`} src={l.image_url} alt={l.label ?? ""} className="es-rb-layer" sizes="(min-width: 1024px) 380px, 100vw" />
        ))}
      </div>
      <figcaption className="es-rb-preview-note">{parts ? "Rendered preview. Parts appear as you pick them." : "Rendered preview. Pick parts and they appear here."}</figcaption>
    </figure>
  );
}
