export const MAX_LISTING_IMAGES = 8;
export const MAX_IMAGE_DATA_CHARS = 520_000;

const DATA_URL = /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=\s]+$/i;

function isRemoteImage(url: string) {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    if (u.username || u.password) return false;
    return true;
  } catch {
    return false;
  }
}

function isLocalPath(url: string) {
  return url.startsWith("/") && !url.startsWith("//") && !url.includes("..") && url.length < 180;
}

export function uniqueImages(list: string[]): string[] {
  const out: string[] = [];
  for (const item of list) {
    const src = item.trim();
    if (!src) continue;
    if (!out.includes(src)) out.push(src);
  }
  return out;
}

/** Accept https URLs, site paths, or compressed JPEG/PNG/WebP data URLs. */
export function sanitizeListingImages(raw: unknown, fallback: string[] = []): string[] {
  const list = Array.isArray(raw) ? raw.map(String) : fallback;
  const out: string[] = [];
  for (const item of list) {
    let src = item.trim();
    if (!src) continue;
    if (src.startsWith("//")) src = `https:${src}`;
    if (src.startsWith("data:image/")) {
      if (!DATA_URL.test(src)) continue;
      if (src.length > MAX_IMAGE_DATA_CHARS) continue;
      out.push(src);
    } else if (isRemoteImage(src) || isLocalPath(src)) {
      out.push(src);
    }
    if (out.length >= MAX_LISTING_IMAGES) break;
  }
  return uniqueImages(out);
}

export function primaryImage(images: string[], fallback?: string | null) {
  return images[0] || fallback || null;
}
