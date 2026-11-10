import { describe, expect, it } from "vitest";
import { rigSrcSet } from "@/components/es/site-image";

const SB = "https://exampleref.supabase.co/storage/v1/object/public/product-images";

describe("rigSrcSet", () => {
  it("maps bundled /rigs photos to their WebP widths", () => {
    expect(rigSrcSet("/rigs/es-cat-pc.jpg")).toBe("/rigs/es-cat-pc-640.webp 640w, /rigs/es-cat-pc-1024.webp 1024w, /rigs/es-cat-pc-1600.webp 1600w");
  });
  it("maps Storage site renders to their WebP twins", () => {
    expect(rigSrcSet(`${SB}/site/es-part-wheel.jpg`)).toBe(
      `${SB}/site/es-part-wheel-640.webp 640w, ${SB}/site/es-part-wheel-1024.webp 1024w, ${SB}/site/es-part-wheel-1600.webp 1600w`,
    );
  });
  it("leaves catalogue uploads, other hosts and data URIs alone", () => {
    expect(rigSrcSet(`${SB}/products/abc.jpg`)).toBeUndefined();
    expect(rigSrcSet("https://example.com/storage/v1/object/public/product-images/site/x.jpg")).toBeUndefined();
    expect(rigSrcSet("data:image/jpeg;base64,AAAA")).toBeUndefined();
    expect(rigSrcSet(null)).toBeUndefined();
  });
});
