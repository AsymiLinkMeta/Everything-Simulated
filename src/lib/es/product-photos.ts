/**
 * Pure helpers for product photos. Stock rig shots under /rigs/ are site art, not
 * product photos, so they never stand in for a product's picture.
 */
/** True for a usable product photo (not empty, not a stock /rigs/ hero shot). */
export function isProductPhoto(src: string | null | undefined): src is string {
  if (!src) return false;
  const s = src.trim();
  if (!s) return false;
  return !/^\/rigs\//.test(s);
}

/** The product's real photos in order, stock art removed. */
export function productPhotos(images: (string | null | undefined)[]): string[] {
  const out: string[] = [];
  for (const src of images) if (isProductPhoto(src) && !out.includes(src.trim())) out.push(src.trim());
  return out;
}

