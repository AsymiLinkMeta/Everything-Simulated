/**
 * Shared client-side image utilities: compression, background removal,
 * and compositing onto the ES charcoal card background.
 */

const CARD_BG_COLOR = "#0a0a0b";

/** Compress an uploaded image to a JPEG data URL, max dimension 1600px. */
export async function compressImage(file: File, maxDim = 1600): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Choose a photo (JPEG, PNG or WebP)");
  if (file.size > 12 * 1024 * 1024) throw new Error("Photo must be under 12 MB");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Could not read that photo");
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  let q = 0.82;
  let data = canvas.toDataURL("image/jpeg", q);
  while (data.length > 420_000 && q > 0.48) {
    q -= 0.1;
    data = canvas.toDataURL("image/jpeg", q);
  }
  if (data.length > 520_000) throw new Error("Photo is still too large after compression");
  return data;
}

/** Detect whether an image has a light background (corner sample). */
export function hasLightBackground(dataUrl: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const w = 48;
      const h = 48;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(true);
      ctx.drawImage(img, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h).data;
      let lightCount = 0;
      const total = w * h;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        if (a < 10) continue;
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        if (brightness > 180) lightCount++;
      }
      resolve(lightCount > total * 0.25);
    };
    img.onerror = () => resolve(true);
    img.src = dataUrl;
  }) as unknown as Promise<boolean>;
}

/** Flood-fill remove the corner-sampled background color, making it transparent. */
export function removeBackground(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(dataUrl);
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imageData.data;
      const w = canvas.width;
      const h = canvas.height;
      const corners = [
        [0, 0],
        [w - 1, 0],
        [0, h - 1],
        [w - 1, h - 1],
      ];
      let bgR = 0;
      let bgG = 0;
      let bgB = 0;
      for (const [cx, cy] of corners) {
        const idx = (cy * w + cx) * 4;
        bgR += d[idx];
        bgG += d[idx + 1];
        bgB += d[idx + 2];
      }
      bgR /= corners.length;
      bgG /= corners.length;
      bgB /= corners.length;
      const threshold = 40;
      for (let i = 0; i < d.length; i += 4) {
        const dr = Math.abs(d[i] - bgR);
        const dg = Math.abs(d[i + 1] - bgG);
        const db = Math.abs(d[i + 2] - bgB);
        if (dr < threshold && dg < threshold && db < threshold) {
          d[i + 3] = 0;
        } else if (dr < threshold + 20 && dg < threshold + 20 && db < threshold + 20) {
          d[i + 3] = Math.round(d[i + 3] * 0.4);
        }
      }
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Composite a (possibly transparent) image onto the ES charcoal card background.
 * The result is a flat JPEG suitable for storing as the prebuild image.
 */
export function compositeOnCharcoal(dataUrl: string, maxDim = 1200): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(dataUrl);
      ctx.fillStyle = CARD_BG_COLOR;
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      let q = 0.82;
      let data = canvas.toDataURL("image/jpeg", q);
      while (data.length > 420_000 && q > 0.48) {
        q -= 0.1;
        data = canvas.toDataURL("image/jpeg", q);
      }
      resolve(data);
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
