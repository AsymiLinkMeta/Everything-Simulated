/**
 * Print kit for one ambassador: branded QR card as SVG, PNG (2000 px wide) and a vector PDF,
 * rendered with the same `brandedQrSvg` the staff portal uses.
 *
 *   npx tsx scripts/ambassador-qr.ts --url <exact url> --name "Name" [--team "Team"] --out <dir> [--base file-stem]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import QR from "qrcode";
import { chromium } from "@playwright/test";
import { brandedQrSvg, CARD_H, CARD_MM, CARD_W, QR_FONT_SRC, QR_LOGO_SRC } from "../src/lib/es/branded-qr";

const args = Object.fromEntries(
  process.argv.slice(2).reduce<string[][]>((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1] ?? ""]] : acc), []),
);
if (!args.url || !args.name || !args.out) throw new Error("--url, --name and --out are required");
const pub = resolve(import.meta.dirname, "../public");
const dataUrl = (rel: string, mime: string) => `data:${mime};base64,${readFileSync(join(pub, rel)).toString("base64")}`;
const svg = brandedQrSvg(QR, {
  url: args.url,
  name: args.name,
  team: args.team,
  logoDataUrl: dataUrl(QR_LOGO_SRC, "image/png"),
  fontTitleDataUrl: dataUrl(QR_FONT_SRC.title, "font/woff2"),
  fontBrandDataUrl: dataUrl(QR_FONT_SRC.brand, "font/woff2"),
});
const out = resolve(args.out);
const base = args.base || "qr";
mkdirSync(out, { recursive: true });
writeFileSync(join(out, `${base}.svg`), svg);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: CARD_W, height: CARD_H }, deviceScaleFactor: 2 });
await page.setContent(`<!doctype html><style>html,body{margin:0;background:#fff}svg{display:block;width:100vw;height:auto}</style>${svg}`);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: join(out, `${base}.png`), clip: { x: 0, y: 0, width: CARD_W, height: CARD_H } });
await page.pdf({ path: join(out, `${base}.pdf`), width: `${CARD_MM.w}mm`, height: `${CARD_MM.h}mm`, printBackground: true, pageRanges: "1" });
await browser.close();
console.log(JSON.stringify({ svg: join(out, `${base}.svg`), png: join(out, `${base}.png`), pdf: join(out, `${base}.pdf`) }));
