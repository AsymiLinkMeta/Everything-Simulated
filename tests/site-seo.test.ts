import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ supabase: {}, supabaseUrl: "", supabaseAnonKey: "" }));

import { DEFAULT_SITE_ORIGIN, normaliseOrigin, SITE_ORIGIN } from "@/lib/site";
import { abs, ORIGIN } from "@/lib/es/seo";
import { CITIES, GUIDES } from "@/lib/es/catalog";
import { renderLlms, renderSitemap, type SeoCatalog } from "../scripts/seo-files";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const app = read("src/App.tsx");
const CATALOG: SeoCatalog = {
  prebuilds: [
    { slug: "starter", name: "Starter Rig", updated_at: "2026-10-01T00:00:00Z", image: "/rigs/starter.jpg", price_ex_gst: 1140800, purchasable: true },
    { slug: "haptic", name: "Haptic", updated_at: null, image: null, price_ex_gst: null, purchasable: false },
  ],
  products: [{ sku: "alpha-15", name: "Alpha 15", brand: "Simagic", updated_at: "2026-09-09T00:00:00Z" }],
  ambassadors: [{ slug: "carter-cosgrove-racing", updated_at: null }],
  blockRules: [{ left_sku: "sr2", right_sku: "tr120s", reason: "SR2 needs a stiffer chassis." }],
  brands: ["Simagic"],
};
const sitemap = renderSitemap(DEFAULT_SITE_ORIGIN, CATALOG, "2026-10-15");
const llms = renderLlms(DEFAULT_SITE_ORIGIN, CATALOG);
const sitemapPaths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

describe("one configurable public host", () => {
  it("defaults to the www host the bare domain redirects to", () => {
    expect(DEFAULT_SITE_ORIGIN).toBe("https://www.everythingsimulated.com.au");
    expect(SITE_ORIGIN).toBe(DEFAULT_SITE_ORIGIN);
    expect(ORIGIN).toBe(SITE_ORIGIN);
    expect(abs("/racing")).toBe("https://www.everythingsimulated.com.au/racing");
  });

  it("normalises VITE_SITE_URL to an origin and rejects junk", () => {
    expect(normaliseOrigin("https://staging.example.com/x?y")).toBe("https://staging.example.com");
    expect(normaliseOrigin("ftp://x")).toBe(DEFAULT_SITE_ORIGIN);
    expect(normaliseOrigin("not a url")).toBe(DEFAULT_SITE_ORIGIN);
  });

  it("index.html, robots, and the generated sitemap and llms.txt use the default host only", () => {
    for (const [f, text] of [["index.html", read("index.html")], ["public/robots.txt", read("public/robots.txt")], ["sitemap.xml", sitemap], ["llms.txt", llms]]) {
      expect(text, f).not.toMatch(/https:\/\/everythingsimulated\.com\.au/);
      expect(text, f).toContain(DEFAULT_SITE_ORIGIN);
    }
  });
});

describe("sitemap", () => {
  it("only lists URLs on the configured host", () => {
    for (const loc of sitemapPaths) expect(loc.startsWith(`${DEFAULT_SITE_ORIGIN}/`)).toBe(true);
  });

  it("has no duplicates and no redirecting legacy paths", () => {
    const paths = sitemapPaths.map((u) => new URL(u).pathname);
    expect(new Set(paths).size).toBe(paths.length);
    for (const legacy of ["/drivers", "/builds", "/catering", "/racing/shop", "/racing/prebuilds"]) {
      expect(paths).not.toContain(legacy);
    }
    // Private surfaces are never in the sitemap.
    expect(paths.some((p) => /^\/(app|staff|login|checkout|order)(\/|$)/.test(p))).toBe(false);
  });

  it("every listed page is a real route", () => {
    const routes = [...app.matchAll(/path="([^"]+)"/g)].map((m) => m[1]).filter((r) => r.startsWith("/"));
    const patterns = routes.map((r) => new RegExp(`^${r.replace(/:[^/]+/g, "[^/]+")}$`));
    for (const loc of sitemapPaths) {
      const p = new URL(loc).pathname;
      expect(patterns.some((re) => re.test(p)), p).toBe(true);
    }
  });

  it("covers every prebuild, part and ambassador from the database, plus guides and cities", () => {
    const paths = new Set(sitemapPaths.map((u) => new URL(u).pathname));
    for (const p of CATALOG.prebuilds) expect(paths.has(`/prebuilds/${p.slug}`), p.slug).toBe(true);
    for (const p of CATALOG.products) expect(paths.has(`/shop/${p.sku}`), p.sku).toBe(true);
    for (const a of CATALOG.ambassadors) expect(paths.has(`/ambassadors/${a.slug}`), a.slug).toBe(true);
    for (const g of GUIDES) expect(paths.has(`/guides/${g.slug}`), g.slug).toBe(true);
    for (const c of CITIES) expect(paths.has(`/au/${c.slug}`), c.slug).toBe(true);
  });
});

describe("llms.txt", () => {
  it("prices prebuilds from the database and says enquiry when there is no price", () => {
    expect(llms).toContain("Starter Rig: $11,408 + GST");
    expect(llms).toContain("Haptic: priced on enquiry");
    expect(llms).toContain("sr2 + tr120s is blocked");
  });
  it("is no longer a hand-written file in public/", () => {
    expect(() => read("public/llms.txt")).toThrow();
    expect(() => read("public/sitemap.xml")).toThrow();
  });
});

describe("no hardcoded catalogue in the frontend", () => {
  it("has no package, rule or price constants left in src/lib/es", () => {
    const catalog = read("src/lib/es/catalog.ts") + read("src/lib/es/content.ts");
    expect(catalog).not.toMatch(/PACKAGES|RULES|priceExGst|sellExGst/);
    expect(catalog).not.toMatch(/\$\d{1,3}(,\d{3})+/);
    expect(read("src/lib/es/seo.ts")).not.toMatch(/\$\d{1,3}(,\d{3})+/);
  });
});

describe("legacy Wix redirects", () => {
  const redirects = read("public/_redirects");
  it.each(["/about", "/technology", "/blank", "/blank-2", "/book-online", "/blog", "/post", "/terms-and-coniditions"])(
    "%s is 301-redirected",
    (from) => {
      expect(redirects).toMatch(new RegExp(`^${from.replace(/[-/]/g, "\\$&")}\\s+\\S+\\s+301`, "m"));
    },
  );
  it("keeps the SPA fallback as the very last rule", () => {
    const rules = redirects.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
    expect(rules.at(-1)).toMatch(/^\/\*\s+\/index\.html\s+200$/);
  });
});
