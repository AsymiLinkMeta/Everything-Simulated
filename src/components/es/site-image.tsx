import type { ImgHTMLAttributes } from "react";

/**
 * Responsive image for the bundled /rigs/*.jpg photos: serves WebP at 640/1024/1600 px
 * (generated next to the originals by scripts/rig-images.sh) with the JPEG as fallback.
 * Any other src (catalogue images, uploads) renders as a plain lazy <img>.
 * Lazy by default; pass priority for the above-the-fold hero.
 */
const LOCAL_RIG = /^\/rigs\/([A-Za-z0-9_+-]+)\.jpg$/;
export const RIG_WIDTHS = [640, 1024, 1600] as const;

export function rigSrcSet(src: string | null | undefined): string | undefined {
  const m = src ? LOCAL_RIG.exec(src) : null;
  return m ? RIG_WIDTHS.map((w) => `/rigs/${m[1]}-${w}.webp ${w}w`).join(", ") : undefined;
}

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string | null | undefined;
  priority?: boolean;
  sizes?: string;
};

export function SiteImage({ src, priority = false, sizes = "100vw", alt = "", ...rest }: Props) {
  if (!src) return null;
  const webp = rigSrcSet(src);
  const img = (
    <img
      src={src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding={priority ? "sync" : "async"}
      {...(priority ? { fetchpriority: "high" } : {})}
      {...rest}
    />
  );
  if (!webp) return img;
  return (
    <picture>
      <source type="image/webp" srcSet={webp} sizes={sizes} />
      {img}
    </picture>
  );
}
