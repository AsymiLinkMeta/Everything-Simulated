import { useEffect, useRef, useState, type ImgHTMLAttributes, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchPrebuildImage } from "@/lib/es/prebuilds";

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

/**
 * A prebuild's photo. List queries leave the image out (it can be a large inline data URI),
 * so when `imageDeferred` is set this fetches it once the frame is near the viewport.
 */
export function PrebuildPhoto({
  prebuild,
  fallback,
  placeholder,
  ...rest
}: Omit<Props, "src"> & {
  prebuild: { id?: string; image?: string | null; imageDeferred?: boolean };
  /** Shown when the prebuild has no image at all. */
  fallback?: string;
  /** Rendered when there is nothing to show (no image and no fallback). */
  placeholder?: ReactNode;
}) {
  const deferred = Boolean(prebuild.imageDeferred && !prebuild.image && prebuild.id);
  const ref = useRef<HTMLSpanElement>(null);
  const [near, setNear] = useState(!deferred || Boolean(rest.priority));
  useEffect(() => {
    if (near || !ref.current) return;
    if (typeof IntersectionObserver === "undefined") return setNear(true);
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setNear(true);
        io.disconnect();
      }
    }, { rootMargin: "400px" });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [near]);
  const q = useQuery({
    queryKey: ["prebuild-image", prebuild.id],
    queryFn: () => fetchPrebuildImage(prebuild.id!),
    enabled: deferred && near,
    staleTime: Infinity,
  });
  const src = prebuild.image || (deferred ? q.data : "") || (deferred && !q.isSuccess ? "" : fallback || "");
  if (!src) return deferred && !q.isSuccess ? <span ref={ref} className="block size-full bg-raised" aria-hidden="true" /> : <>{placeholder ?? null}</>;
  return <SiteImage src={src} {...rest} />;
}

/** The prebuild's image, fetching it if the list left it out. "" until known. */
export function usePrebuildImage(prebuild: { id?: string; image?: string | null; imageDeferred?: boolean } | null | undefined): string {
  const deferred = Boolean(prebuild?.imageDeferred && !prebuild.image && prebuild.id);
  const q = useQuery({
    queryKey: ["prebuild-image", prebuild?.id],
    queryFn: () => fetchPrebuildImage(prebuild!.id!),
    enabled: deferred,
    staleTime: Infinity,
  });
  return prebuild?.image || (deferred ? q.data ?? "" : "");
}
