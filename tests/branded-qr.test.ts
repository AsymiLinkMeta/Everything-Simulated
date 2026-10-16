import { describe, expect, it } from "vitest";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { alignmentCoords, brandedQrCaption, brandedQrSvg, CARD_H, CARD_W, centreBadgeLimit, jpegToPdf } from "@/lib/es/branded-qr";

/** Paint the SVG's module paths (and the dark centre badge) into pixels and decode them. */
function decodeSvg(svg: string) {
  const w = CARD_W;
  const h = CARD_H;
  const px = new Uint8ClampedArray(w * h * 4).fill(255);
  const fill = (x: number, y: number, rw: number, rh: number) => {
    for (let yy = Math.round(y); yy < Math.round(y + rh); yy++)
      for (let xx = Math.round(x); xx < Math.round(x + rw); xx++) {
        const i = (yy * w + xx) * 4;
        px[i] = px[i + 1] = px[i + 2] = 0;
      }
  };
  for (const d of svg.matchAll(/<path fill="[^"]+" d="([^"]*)"/g))
    for (const m of d[1].matchAll(/M([\d.]+) ([\d.]+)h([\d.]+)v([\d.]+)/g)) fill(+m[1], +m[2], +m[3], +m[4]);
  const badge = svg.match(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" rx="[\d.]+" fill="#0b0b0c"\/>/)!;
  fill(+badge[1], +badge[2], +badge[3], +badge[4]);
  return jsQR(px, w, h)?.data;
}

describe("branded ambassador QR", () => {
  it("alignment pattern table matches ISO 18004", () => {
    expect(alignmentCoords(1)).toEqual([]);
    expect(alignmentCoords(2)).toEqual([6, 18]);
    expect(alignmentCoords(8)).toEqual([6, 24, 42]);
    expect(alignmentCoords(14)).toEqual([6, 26, 46, 66]);
    expect(alignmentCoords(32)).toEqual([6, 34, 60, 86, 112, 138]);
  });

  it("never puts the logo over the centre alignment pattern", () => {
    for (const v of [7, 8, 13, 21, 27]) expect(centreBadgeLimit(v)).toBe(0);
    expect(centreBadgeLimit(14)).toBe(13);
    const svg = brandedQrSvg(QRCode, { url: "https://everythingsimulated.netlify.app/ambassadors/cherrie-racing?ref=CHERRIE-RACING", name: "Alyssa Cherrie" });
    // v8 is the smallest H symbol for this URL, but its alignment pattern sits on the centre: we go to v14.
    expect((svg.match(/<path fill="#000000" d="/g) ?? []).length).toBe(1);
  });

  it("decodes to the exact referral URL with the centre badge filled in", () => {
    for (const url of [
      "https://everythingsimulated.netlify.app/ambassadors/cherrie-racing?ref=CHERRIE-RACING",
      "https://everythingsimulated.netlify.app/ambassadors/carter-cosgrove-racing?ref=COSGROVE",
      "https://www.everythingsimulated.com.au/ambassadors/a-very-long-ambassador-slug-name-for-testing?ref=ABCDEFGHIJKLMNOPQRSTUVWX",
      "https://es.au/a?ref=ABC",
    ]) {
      expect(decodeSvg(brandedQrSvg(QRCode, { url, name: "Test" }))).toBe(url);
    }
  });

  it("captions the card with name, team and brand, escaped", () => {
    expect(brandedQrCaption("Alyssa Cherrie", "Cherrie Racing")).toBe("Alyssa Cherrie · Cherrie Racing");
    expect(brandedQrCaption("Carter Cosgrove Racing", " carter cosgrove racing ")).toBe("Carter Cosgrove Racing");
    expect(brandedQrCaption("Solo", null)).toBe("Solo");
    const svg = brandedQrSvg(QRCode, { url: "https://example.com/?ref=ABC", name: "A <b>&", team: "T" });
    expect(svg).toContain("A &lt;b&gt;&amp; · T");
    expect(svg).toContain("EVERYTHING SIMULATED");
    expect(svg).not.toContain("<b>");
  });

  it("wraps a JPEG in a valid one-page PDF", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const pdf = jpegToPdf(jpeg, { w: 2, h: 2 }, { w: 100, h: 132 });
    const text = new TextDecoder("latin1").decode(pdf);
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("/MediaBox [0 0 283.46 374.17]");
    expect(text).toContain("/Filter /DCTDecode /Length 4");
    const xref = +text.match(/startxref\n(\d+)/)![1];
    expect(text.slice(xref, xref + 4)).toBe("xref");
    for (const m of text.matchAll(/(\d{10}) 00000 n/g)) expect(text.slice(+m[1]).match(/^\d+ 0 obj/)).not.toBeNull();
  });
});
