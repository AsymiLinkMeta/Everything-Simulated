import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SiteImage } from "./site-image";
import { isProductPhoto } from "@/lib/es/product-photos";
import { SITE_MEDIA_QUERY_KEY, categoryLabel, categoryMedia, fetchSiteMedia } from "@/lib/es/site-media";

export function useSiteMedia() {
  return useQuery({ queryKey: SITE_MEDIA_QUERY_KEY, queryFn: fetchSiteMedia, staleTime: 30 * 60_000, retry: false });
}

/**
 * The plain brand tile shown where there's no photo: the category render from
 * site_media when one is set, otherwise the ES mark and the category name. Never
 * says "coming" or "pending".
 */
export function EsFallback({
  category,
  alt,
  className = "",
  sizes,
  label,
  fallbackKey = "fallback:product",
}: {
  category?: string | null;
  alt: string;
  className?: string;
  sizes?: string;
  label?: string;
  fallbackKey?: string;
}) {
  const media = useSiteMedia();
  const item = categoryMedia(media.data, category, fallbackKey);
  const name = label || categoryLabel(category);
  const [artFailed, setArtFailed] = useState<string | null>(null);
  if (item && artFailed !== item.url) {
    return (
      <div className={`ds-fallback has-art ${className}`} data-testid="photo-fallback">
        <SiteImage src={item.url} alt={alt} sizes={sizes} onFailed={() => setArtFailed(item.url)} />
      </div>
    );
  }
  return (
    <div className={`ds-fallback ${className}`} role="img" aria-label={alt} data-testid="photo-fallback">
      <img src="/logo-192.png" alt="" width={48} height={48} decoding="async" loading="lazy" className="ds-fallback-mark" />
      <span className="ds-fallback-label">{name}</span>
    </div>
  );
}

/** A product's own photo, or the brand fallback. Never a stock rig shot. */
export function ProductPhoto({
  src,
  alt,
  className = "",
  priority,
  sizes,
  label,
  category,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
  /** Overrides the category name on the fallback tile. */
  label?: string;
  category?: string | null;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  if (isProductPhoto(src) && failed !== src) {
    return <SiteImage src={src} alt={alt} priority={priority} sizes={sizes} className={className} onFailed={() => setFailed(src ?? null)} />;
  }
  return <EsFallback category={category} alt={alt} className={className} sizes={sizes} label={label} />;
}
