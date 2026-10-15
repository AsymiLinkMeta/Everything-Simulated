import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ supabase: {}, supabaseUrl: "", supabaseAnonKey: "" }));

import { DEFAULT_SITE_ORIGIN, normaliseOrigin, SITE_ORIGIN } from "@/lib/site";
import { abs, ORIGIN } from "@/lib/es/seo";
import { CITIES, GUIDES, PACKAGES } from "@/lib/es/catalog";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const app = read("src/App.tsx");
const sitemapPaths = [...read("public/sitemap.xml").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

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

  it("index.html, sitemap, robots and llms.txt all use the default host only", () => {
    for (const f of ["index.html", "public/sitemap.xml", "public/robots.txt", "public/llms.txt"]) {
      const text = read(f);
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

  it("covers every package, guide and city landing page", () => {
    const paths = new Set(sitemapPaths.map((u) => new URL(u).pathname));
    for (const p of PACKAGES) expect(paths.has(`/prebuilds/${p.slug}`), p.slug).toBe(true);
    for (const g of GUIDES) expect(paths.has(`/guides/${g.slug}`), g.slug).toBe(true);
    for (const c of CITIES) expect(paths.has(`/au/${c.slug}`), c.slug).toBe(true);
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
