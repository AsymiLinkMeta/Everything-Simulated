import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

/**
 * Real 404s on a static host. public/_redirects ends with a catch-all SPA rewrite
 * (`/* /index.html 200`), which answers 200 for every URL, so crawlers index typos
 * and dead links as real pages. At build time this plugin swaps that line for one
 * 200 rewrite per route in src/App.tsx, then `/* /index.html 404` last: unknown URLs
 * still get the app (and its "not in the workshop" page), but with a 404 status.
 *
 * Dynamic sections (/shop/:sku, /prebuilds/:slug, ...) and the signed-in portals get
 * a splat, so a product added in the database works before the next deploy; the app
 * shows its own not-found state (noindex) for a slug that doesn't exist.
 */

/** Routes with nested child routes in App.tsx (rendered under a layout). */
export const LAYOUT_PREFIXES = ["/app", "/staff"] as const;

export const SPA_FALLBACK = /^\/\*\s+\/index\.html\s+200\s*$/m;

/** Top-level route paths in App.tsx, in source order (the `*` catch-all is skipped). */
export function appRoutePaths(appSource: string): string[] {
  const out: string[] = [];
  for (const m of appSource.matchAll(/<Route\s+path="(\/[^"]*)"/g)) if (!out.includes(m[1])) out.push(m[1]);
  return out;
}

/** Netlify rewrite sources for the app's routes: exact paths, plus a splat for each dynamic section and layout. */
export function rewriteSources(paths: string[]): string[] {
  const out: string[] = [];
  const add = (p: string) => {
    if (!out.includes(p)) out.push(p);
  };
  for (const p of paths) {
    const segs = p.split("/");
    const dyn = segs.findIndex((s) => s.startsWith(":"));
    if (dyn === -1) {
      add(p);
      if ((LAYOUT_PREFIXES as readonly string[]).includes(p)) add(`${p}/*`);
    } else {
      add(`${segs.slice(0, dyn).join("/")}/*`);
    }
  }
  return out;
}

/** public/_redirects with its SPA fallback replaced by explicit rewrites and a 404 catch-all. */
export function buildRedirects(redirects: string, appSource: string): string {
  if (!SPA_FALLBACK.test(redirects)) throw new Error("[es-spa-redirects] public/_redirects has no `/* /index.html 200` fallback to replace");
  const sources = rewriteSources(appRoutePaths(appSource));
  const width = Math.max(...sources.map((s) => s.length)) + 2;
  const rules = [
    "# App routes (generated from src/App.tsx by scripts/spa-redirects.ts).",
    ...sources.map((s) => `${s.padEnd(width)}/index.html   200`),
    "",
    "# Anything else is not a page: serve the app's not-found screen with a real 404.",
    `${"/*".padEnd(width)}/index.html   404`,
  ].join("\n");
  return redirects.replace(SPA_FALLBACK, rules);
}

export function spaRedirects(root: string): Plugin {
  let outDir = "dist";
  return {
    name: "es-spa-redirects",
    apply: "build",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const file = path.join(outDir, "_redirects");
      if (!fs.existsSync(file)) return;
      const app = fs.readFileSync(path.join(root, "src/App.tsx"), "utf8");
      fs.writeFileSync(file, buildRedirects(fs.readFileSync(file, "utf8"), app));
    },
  };
}
