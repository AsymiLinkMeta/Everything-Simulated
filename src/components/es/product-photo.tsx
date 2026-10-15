import { Camera } from "lucide-react";
import { SiteImage } from "./site-image";
import { isProductPhoto } from "@/lib/es/product-photos";

/**
 * A product's own photo, or an honest "Photo coming" tile. Never a stock rig shot:
 * a wheelbase shouldn't be pictured as a whole simulator.
 */
export function ProductPhoto({
  src,
  alt,
  className = "",
  priority,
  sizes,
  label,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
  /** Short label under the icon, e.g. the brand. */
  label?: string;
}) {
  if (isProductPhoto(src)) {
    return <SiteImage src={src} alt={alt} priority={priority} sizes={sizes} className={className} />;
  }
  return (
    <div className={`es-photo-coming ${className}`} role="img" aria-label={`${alt}: photo coming`} data-testid="photo-coming">
      <Camera className="size-6" aria-hidden="true" />
      <span className="es-photo-coming-text">Photo coming</span>
      {label ? <span className="es-photo-coming-label">{label}</span> : null}
    </div>
  );
}
