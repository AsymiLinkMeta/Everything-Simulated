import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LAYOUT_PREFIXES, appRoutePaths, buildRedirects, rewriteSources } from "../scripts/spa-redirects";

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "src/App.tsx"), "utf8");
const redirects = fs.readFileSync(path.join(root, "public/_redirects"), "utf8");

describe("spa redirects", () => {
  it("reads the app's top-level routes", () => {
    const paths = appRoutePaths(app);
    for (const p of ["/", "/shop", "/shop/:sku", "/prebuilds/:slug", "/login", "/app", "/staff", "/checkout"]) expect(paths).toContain(p);
    expect(paths).not.toContain("*");
  });

  it("layout prefixes exist in App.tsx", () => {
    for (const p of LAYOUT_PREFIXES) expect(appRoutePaths(app)).toContain(p);
  });

  it("splats dynamic sections and layouts, keeps static paths exact", () => {
    const s = rewriteSources(["/", "/shop", "/shop/:sku", "/app", "/au/:city", "/builds/:slug"]);
    expect(s).toEqual(["/", "/shop", "/shop/*", "/app", "/app/*", "/au/*", "/builds/*"]);
  });

  it("replaces the 200 fallback with route rewrites and a final 404", () => {
    const out = buildRedirects(redirects, app);
    const rules = out.split("\n").filter((l) => l.trim() && !l.startsWith("#"));
    expect(rules.at(-1)).toMatch(/^\/\*\s+\/index\.html\s+404$/);
    expect(out).not.toMatch(/^\/\*\s+\/index\.html\s+200\s*$/m);
    expect(out).toMatch(/^\/shop\/\*\s+\/index\.html\s+200$/m);
    expect(out).toMatch(/^\/staff\/\*\s+\/index\.html\s+200$/m);
    expect(out).toMatch(/^\/\s+\/index\.html\s+200$/m);
    // Legacy 301s stay ahead of the rewrites (first match wins).
    expect(out.indexOf("/about")).toBeLessThan(out.indexOf("/index.html   200"));
  });

  it("refuses a _redirects without the fallback", () => {
    expect(() => buildRedirects("/about /prebuilds 301\n", app)).toThrow(/fallback/);
  });
});
