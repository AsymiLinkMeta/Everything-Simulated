import { SiteImage } from "./site-image";
import { isProductPhoto } from "@/lib/es/product-photos";

export function initials(name: string): string {
  const parts = name.replace(/racing|motorsport/gi, "").trim().split(/\s+/).filter(Boolean);
  const letters = (parts.length > 1 ? [parts[0], parts[parts.length - 1]] : parts).map((p) => p[0]?.toUpperCase() ?? "");
  return letters.join("") || "ES";
}

/**
 * An ambassador's own photo from their profile. Bundled studio shots under /rigs/
 * aren't portraits, so they (and a missing photo) show the initials tile instead.
 */
export function PersonPhoto({ name, src, priority, sizes }: { name: string; src?: string | null; priority?: boolean; sizes?: string }) {
  if (isProductPhoto(src)) return <SiteImage src={src} alt={name} priority={priority} sizes={sizes} />;
  return (
    <div className="ds-person-fallback" role="img" aria-label={name} data-testid="person-fallback">
      <span aria-hidden="true">{initials(name)}</span>
    </div>
  );
}
