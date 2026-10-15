import { useEffect, useState } from "react";
import { rigView, type LayerRow } from "@/lib/es/builder-core";
import { RIG_PHOTO_BASE, RIG_PHOTO_FRAMES, RIG_PHOTO_OVERLAYS, RIG_PHOTO_SIZE, type RigPhotoFile } from "./rig-photo";
import { SiteImage } from "./site-image";

function Photo({ file, className, ...rest }: { file: RigPhotoFile; className: string; onLoad?: () => void } & Record<`data-${string}`, string | undefined>) {
  return (
    <picture>
      <source srcSet={RIG_PHOTO_BASE + file.avif} type="image/avif" />
      <img src={RIG_PHOTO_BASE + file.webp} alt="" className={className} decoding="async" {...rest} />
    </picture>
  );
}

/**
 * The builder's rig preview: a studio photo of a generic, Everything Simulated branded profile rig
 * (rendered in Blender, see scripts/rig3d), one per screen layout with and without a motion platform,
 * with the add-ons (PC, side mount, shifter, handbrake, VR headset) as layers on top. Only the photo
 * for the current build is loaded; when it changes, the last photo stays up until the next one has
 * loaded, then fades across. Staff layer art in builder_layers replaces a category's overlay.
 */
export function RigPreview({ layers, picked, screens = 0 }: { layers: LayerRow[]; picked: Set<string>; screens?: number }) {
  const overridden = new Set(layers.map((l) => l.category));
  const view = rigView(picked, screens, overridden);
  const [shown, setShown] = useState(view.frame);
  const [last, setLast] = useState<string | null>(null);
  useEffect(() => {
    if (view.frame !== shown) setLast(shown);
  }, [view.frame, shown]);
  const parts = picked.size;
  return (
    <figure
      className="es-rb-preview"
      data-testid="rig-preview"
      data-mode={layers.length ? "layers" : "rendered"}
      data-frame={view.frame}
      data-raised={view.raised || undefined}
      data-empty={view.empty || undefined}
    >
      <div className="es-rp-stage" role="img" aria-label={`Rig preview, ${parts} part${parts === 1 ? "" : "s"} picked`} style={{ aspectRatio: `${RIG_PHOTO_SIZE.width} / ${RIG_PHOTO_SIZE.height}` }}>
        {last && last !== view.frame && RIG_PHOTO_FRAMES[last] ? <Photo key={`last-${last}`} file={RIG_PHOTO_FRAMES[last]} className="es-rp-frame is-last" /> : null}
        <Photo
          key={view.frame}
          file={RIG_PHOTO_FRAMES[view.frame]}
          className={`es-rp-frame${view.empty ? " is-empty" : ""}`}
          data-part="frame"
          data-frame={view.frame}
          onLoad={() => {
            setShown(view.frame);
            setLast(null);
          }}
        />
        {view.overlays.map((o) => (
          <Photo key={o} file={RIG_PHOTO_OVERLAYS[o]} className="es-rp-layer" data-part={o.replace("--raised", "")} data-file={o} />
        ))}
        {layers.map((l) => (
          <SiteImage key={`${l.category}-${l.sku ?? "default"}`} src={l.image_url} alt={l.label ?? ""} className="es-rb-layer" sizes="(min-width: 1280px) 440px, (min-width: 1024px) 380px, 100vw" />
        ))}
      </div>
      <figcaption className="es-rb-preview-note">{parts ? "Rendered preview of your build. Add-ons appear as you pick them." : "Rendered preview. Pick parts and your rig appears here."}</figcaption>
    </figure>
  );
}
