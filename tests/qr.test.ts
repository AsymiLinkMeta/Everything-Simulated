import { describe, expect, it } from "vitest";
import QRCode from "qrcode";
import jsQR from "jsqr";

// The QR codes we hand ambassadors must actually scan. Render the matrix to pixels and decode it.
function decode(text: string) {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const margin = 4;
  const scale = 4;
  const w = (n + margin * 2) * scale;
  const px = new Uint8ClampedArray(w * w * 4).fill(255);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      if (qr.modules.get(x, y))
        for (let dy = 0; dy < scale; dy++)
          for (let dx = 0; dx < scale; dx++) {
            const i = (((y + margin) * scale + dy) * w + (x + margin) * scale + dx) * 4;
            px[i] = px[i + 1] = px[i + 2] = 0;
          }
  return jsQR(px, w, w)?.data;
}

describe("ambassador QR codes", () => {
  it("decode back to the referral URL", () => {
    for (const url of [
      "https://www.everythingsimulated.com.au/ambassadors/carter-cosgrove-racing?ref=COSGROVE",
      "https://www.everythingsimulated.com.au/ambassadors/a-very-long-ambassador-slug-name-for-testing?ref=ABCDEFGHIJKLMNOPQRSTUVWX",
    ]) {
      expect(decode(url)).toBe(url);
    }
  });
  it("renders an SVG", async () => {
    const svg = await QRCode.toString("https://example.com", { type: "svg" });
    expect(svg).toMatch(/^<svg/);
  });
});
