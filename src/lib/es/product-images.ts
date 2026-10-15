/**
 * Product photos live in the public Supabase Storage bucket "product-images";
 * catalog_products.images keeps their public URLs (first = shop photo).
 * Stock rig shots under /rigs/ are site art, not product photos, so they are
 * never shown as a product's picture: no photo means an honest "photo coming" tile.
 */
import { supabase, supabaseAnonKey, supabaseUrl } from "@/lib/db";
export { isProductPhoto, productPhotos } from "./product-photos";

export const PRODUCT_IMAGE_BUCKET = "product-images";

export function safeFolder(raw: string | undefined): string {
  const s = (raw ?? "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return s || "drafts";
}

export function publicImageUrl(path: string): string {
  const base = supabaseUrl.replace(/\/+$/, "");
  return `${base}/storage/v1/object/public/${PRODUCT_IMAGE_BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

function extFor(type: string) {
  return type === "image/png" ? "png" : type === "image/jpeg" ? "jpg" : "webp";
}

/** Upload one (already compressed) photo; staff only (Storage RLS). Returns its public URL. */
export async function uploadProductImage(blob: Blob, folder?: string): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in as staff to upload photos");
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const path = `${safeFolder(folder)}/${id}.${extFor(blob.type)}`;
  const res = await fetch(`${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/${PRODUCT_IMAGE_BUCKET}/${path}`, {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": blob.type || "image/webp",
      "Cache-Control": "max-age=31536000",
    },
    body: blob,
  });
  if (!res.ok) {
    let msg = "";
    try {
      msg = ((await res.json()) as { message?: string }).message ?? "";
    } catch {
      /* not json */
    }
    throw new Error(msg ? `Upload failed: ${msg}` : `Upload failed (${res.status})`);
  }
  return publicImageUrl(path);
}
