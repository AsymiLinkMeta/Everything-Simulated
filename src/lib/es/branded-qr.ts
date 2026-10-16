import type { QRCode } from "qrcode";

/**
 * Branded ambassador QR card: an error-correction-H QR code (black modules,
 * brand-red finder centres, 4-module quiet zone) with the ES logo in the
 * middle, above a caption card ("Name · Team" / "Everything Simulated").
 *
 * Pure string building so the staff portal (browser) and the print scripts
 * (Node) produce the same artwork. Assets are passed in as data URLs so the
 * SVG is self-contained and renders the same as an <img>, on canvas or in print.
 */
export const BRAND_RED = "#e10600";
export const CARD_W = 1000;
export const CARD_H = 1320;
/** Physical print size of the card in mm (same aspect as the SVG). */
export const CARD_MM = { w: 100, h: 132 } as const;

export const QR_LOGO_SRC = "/Everything_Simulated_LOGO_W+R.png";
export const QR_FONT_SRC = { title: "/fonts/teko-latin-600.woff2", brand: "/fonts/teko-latin-500.woff2" } as const;

export type BrandedQrInput = {
  /** The exact URL encoded in the QR code. */
  url: string;
  name: string;
  /** Team or brand, shown after the name when it differs from it. */
  team?: string | null;
  logoDataUrl?: string | null;
  fontTitleDataUrl?: string | null;
  fontBrandDataUrl?: string | null;
  /** Badge width as a fraction of the symbol (tuning; default below). */
  badgeRatio?: number;
  /** Logo size inside the badge (tuning). */
  logoScale?: number;
};

type QrLib = { create: (text: string, opts: { errorCorrectionLevel: "H"; version?: number }) => QRCode };

/** Row/column centres of the alignment patterns for a QR version (ISO 18004 table, same formula as the qrcode library). */
export function alignmentCoords(version: number): number[] {
  if (version === 1) return [];
  const n = version * 4 + 17;
  const count = Math.floor(version / 7) + 2;
  const step = version === 32 ? 26 : Math.ceil((n - 13) / (2 * count - 2)) * 2;
  const out = [n - 7];
  for (let i = 1; i < count - 1; i++) out.unshift(out[0] - step);
  out.unshift(6);
  return out;
}

/**
 * Largest odd badge (in modules) that sits in the centre with a one-module white ring
 * without covering an alignment pattern. 0 when an alignment pattern sits on the centre.
 * Covering the centre alignment pattern makes decoders (zbar, ZXing) lock onto look-alike
 * shapes in the logo and misread the grid, so we never do it.
 */
export function centreBadgeLimit(version: number): number {
  const n = version * 4 + 17;
  const c = (n - 1) / 2;
  const coords = alignmentCoords(version).filter((a) => a !== 6 && a !== n - 7 ? true : false);
  if (coords.includes(c)) return 0;
  const lo = Math.max(8, ...coords.filter((a) => a < c).map((a) => a + 2)); // past the pattern (and the finders)
  const hi = Math.min(n - 9, ...coords.filter((a) => a > c).map((a) => a - 2));
  const half = Math.min(c - lo, hi - c) - 1; // modules from centre to the last free one
  let k = 2 * (half - 1) + 1; // leave the ring
  if (k % 2 === 0) k -= 1;
  return Math.max(0, k);
}

export function brandedQrCaption(name: string, team?: string | null) {
  const n = name.trim();
  const t = (team ?? "").trim();
  return t && t.toLowerCase() !== n.toLowerCase() ? `${n} · ${t}` : n;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const num = (v: number) => +v.toFixed(2);

/** Font size (and a squeeze for very long names) so a Teko line fits `max` px. */
function fitText(text: string, max: number, size: number, min: number) {
  const em = 0.4; // average advance of Teko text is ~0.36em; keep some headroom
  const s = Math.max(min, Math.min(size, max / (Math.max(text.length, 1) * em)));
  const squeeze = text.length * em * s > max;
  return { size: Math.round(s), attrs: squeeze ? ` textLength="${max}" lengthAdjust="spacingAndGlyphs"` : "" };
}

export function brandedQrSvg(lib: QrLib, input: BrandedQrInput): string {
  // Smallest version whose centre is free of alignment patterns and fits a decent badge.
  const ratio = input.badgeRatio ?? 0.22;
  let qr = lib.create(input.url, { errorCorrectionLevel: "H" });
  for (let v = qr.version; v <= 40; v++) {
    const n = v * 4 + 17;
    if (centreBadgeLimit(v) >= Math.min(Math.round(n * 0.17) | 1, 13)) {
      if (v !== qr.version) qr = lib.create(input.url, { errorCorrectionLevel: "H", version: v });
      break;
    }
  }
  const n = qr.modules.size;
  const quiet = 4;
  const box = 840;
  const x0 = (CARD_W - box) / 2;
  const y0 = 56;
  const cell = box / (n + quiet * 2);
  const ox = x0 + quiet * cell;
  const oy = y0 + quiet * cell;

  // Centre badge: an odd number of modules, ~22% of the symbol (well under H's 30% recovery).
  let k = Math.min(Math.round(n * ratio), centreBadgeLimit(qr.version));
  if (k % 2 === 0) k -= 1;
  const k0 = (n - k) / 2; // badge spans modules [k0, k0 + k)
  const inFinderCore = (r: number, c: number) => {
    const core = (R: number, C: number) => r >= R + 2 && r <= R + 4 && c >= C + 2 && c <= C + 4;
    return core(0, 0) || core(0, n - 7) || core(n - 7, 0);
  };
  // The badge plus a one-module white ring is left clear of modules.
  const underBadge = (r: number, c: number) => r >= k0 - 1 && r <= k0 + k && c >= k0 - 1 && c <= k0 + k;

  let dark = "";
  let red = "";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!qr.modules.get(r, c)) continue;
      // Merge horizontal runs into one rect-shaped subpath.
      if (underBadge(r, c)) continue;
      const isRed = inFinderCore(r, c);
      let len = 1;
      while (c + len < n && qr.modules.get(r, c + len) && !underBadge(r, c + len) && inFinderCore(r, c + len) === isRed) len++;
      const d = `M${num(ox + c * cell)} ${num(oy + r * cell)}h${num(len * cell)}v${num(cell)}h${num(-len * cell)}z`;
      if (isRed) red += d;
      else dark += d;
      c += len - 1;
    }
  }

  const pad = cell;
  const bx = ox + k0 * cell - pad;
  const bs = k * cell + pad * 2;
  const inner = k * cell;
  const ls = input.logoScale ?? 0.88;
  const logo = input.logoDataUrl
    ? `<image href="${input.logoDataUrl}" x="${num(ox + k0 * cell + inner * (1 - ls) / 2)}" y="${num(oy + k0 * cell + inner * (1 - ls) / 2)}" width="${num(inner * ls)}" height="${num(inner * ls)}" preserveAspectRatio="xMidYMid meet"/>`
    : `<text x="${num(CARD_W / 2)}" y="${num(oy + (k0 + k / 2) * cell + inner * 0.16)}" text-anchor="middle" font-family="Teko, 'Arial Narrow', sans-serif" font-weight="600" font-size="${num(inner * 0.5)}" fill="#fff">E<tspan fill="${BRAND_RED}">S</tspan></text>`;

  const caption = brandedQrCaption(input.name, input.team);
  const title = fitText(caption, 800, 84, 40);
  const fonts = [
    input.fontTitleDataUrl ? `@font-face{font-family:"ES Teko";font-weight:600;src:url(${input.fontTitleDataUrl}) format("woff2")}` : "",
    input.fontBrandDataUrl ? `@font-face{font-family:"ES Teko";font-weight:500;src:url(${input.fontBrandDataUrl}) format("woff2")}` : "",
  ].join("");
  const family = `'ES Teko', Teko, 'Arial Narrow', sans-serif`;
  const cardY = 960;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CARD_W} ${CARD_H}" width="${CARD_W}" height="${CARD_H}" role="img" aria-label="${esc(`QR code for ${caption}: ${input.url}`)}">`,
    `<title>${esc(`${caption} · Everything Simulated`)}</title>`,
    fonts ? `<defs><style>${fonts}</style></defs>` : "",
    `<rect width="${CARD_W}" height="${CARD_H}" fill="#ffffff"/>`,
    `<g shape-rendering="crispEdges"><path fill="#000000" d="${dark}"/><path fill="${BRAND_RED}" d="${red}"/></g>`,
    `<rect x="${num(bx)}" y="${num(oy + k0 * cell - pad)}" width="${num(bs)}" height="${num(bs)}" rx="${num(bs * 0.18)}" fill="#ffffff"/>`,
    `<rect x="${num(ox + k0 * cell)}" y="${num(oy + k0 * cell)}" width="${num(inner)}" height="${num(inner)}" rx="${num(inner * 0.16)}" fill="#0b0b0c"/>`,
    logo,
    `<rect x="60" y="${cardY}" width="880" height="300" rx="28" fill="#0b0b0c"/>`,
    `<clipPath id="es-qr-card"><rect x="60" y="${cardY}" width="880" height="300" rx="28"/></clipPath>`,
    `<rect x="60" y="${cardY}" width="880" height="10" fill="${BRAND_RED}" clip-path="url(#es-qr-card)"/>`,
    `<text x="500" y="${cardY + 125}" text-anchor="middle" font-family="${family}" font-weight="600" font-size="${title.size}" fill="#ffffff"${title.attrs}>${esc(caption)}</text>`,
    `<rect x="440" y="${cardY + 165}" width="120" height="4" fill="${BRAND_RED}"/>`,
    `<text x="500" y="${cardY + 245}" text-anchor="middle" font-family="${family}" font-weight="500" font-size="54" letter-spacing="7" fill="${BRAND_RED}">EVERYTHING SIMULATED</text>`,
    `</svg>`,
  ].join("");
}

/**
 * Minimal single-page PDF wrapping one baseline JPEG (DCTDecode), sized in mm.
 * Enough for a print-ready raster card without pulling in a PDF library.
 */
export function jpegToPdf(jpeg: Uint8Array, px: { w: number; h: number }, mm: { w: number; h: number }): Uint8Array<ArrayBuffer> {
  const pt = (v: number) => num((v / 25.4) * 72);
  const W = pt(mm.w);
  const H = pt(mm.h);
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let len = 0;
  const push = (b: Uint8Array | string) => {
    const u = typeof b === "string" ? enc.encode(b) : b;
    parts.push(u);
    len += u.length;
  };
  const obj = (id: number, body: () => void) => {
    offsets[id] = len;
    push(`${id} 0 obj\n`);
    body();
    push(`\nendobj\n`);
  };
  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  obj(1, () => push("<< /Type /Catalog /Pages 2 0 R >>"));
  obj(2, () => push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"));
  obj(3, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`));
  obj(4, () => {
    push(`<< /Type /XObject /Subtype /Image /Width ${px.w} /Height ${px.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
    push(jpeg);
    push("\nendstream");
  });
  const content = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
  obj(5, () => push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));
  const xref = len;
  push(`xref\n0 6\n0000000000 65535 f \n${[1, 2, 3, 4, 5].map((i) => `${String(offsets[i]).padStart(10, "0")} 00000 n \n`).join("")}`);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
