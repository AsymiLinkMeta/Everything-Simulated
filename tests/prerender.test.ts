import { describe, expect, it } from "vitest";
import { applyHead, rewriteRedirects, shellHtml } from "../scripts/prerender.mjs";
import { pageHead } from "@/lib/es/seo";

const template = `<!doctype html><html><head>
    <title>Shell title</title>
    <meta name="description" content="Shell description" />
    <meta name="robots" content="index,follow" />
    <link rel="canonical" href="https://www.everythingsimulated.com.au/" />
    <link rel="alternate" hreflang="en-AU" href="https://www.everythingsimulated.com.au/" />
    <meta property="og:url" content="https://www.everythingsimulated.com.au/" />
    <meta property="og:title" content="Shell title" />
  </head><body><div id="root"></div></body></html>`;

describe("prerender applyHead", () => {
  it("replaces the shell's tags with the route's own", () => {
    const head = pageHead({ title: "Racing | ES", description: "Racing rigs.", path: "/racing" });
    const url = "https://www.everythingsimulated.com.au/racing";
    const out = applyHead(template, head, { url, noindex: false });
    expect(out.canonical).toBe(url);
    expect(out.html).toContain("<title>Racing | ES</title>");
    expect(out.html).toContain('<meta name="description" content="Racing rigs." />');
    expect(out.html).toContain(`<link rel="canonical" href="${url}" />`);
    expect(out.html).toContain(`<meta property="og:url" content="${url}" />`);
    expect(out.html).not.toContain("Shell title");
    expect(out.html.match(/rel="canonical"/g)).toHaveLength(1);
  });

  it("drops the canonical and alternates on noindex pages", () => {
    const head = pageHead({ title: "Not found", description: "Missing.", path: "/x", index: false });
    const out = applyHead(template, head, { url: "https://www.everythingsimulated.com.au/x", noindex: true });
    expect(out.canonical).toBeNull();
    expect(out.html).not.toContain('rel="canonical"');
    expect(out.html).not.toContain("hreflang");
    expect(out.html).toMatch(/<meta name="robots" content="noindex/);
  });
});

describe("prerender rewriteRedirects", () => {
  it("serves prerendered pages from files, the rest from the shell, and 404s the catch-all", () => {
    const input = ["/racing /index.html 200", "/shop/* /index.html 200", "/old /new 301", "/* /index.html 404"].join("\n");
    expect(rewriteRedirects(input, ["/racing"])).toBe(["/shop/* /spa.html 200", "/old /new 301", "/* /404.html 404", ""].join("\n"));
  });
});

describe("prerender shellHtml", () => {
  it("drops the home-page canonical, hreflang and og:url from the SPA shell", () => {
    const out = shellHtml(template);
    expect(out).not.toContain('rel="canonical"');
    expect(out).not.toContain("hreflang");
    expect(out).not.toContain("og:url");
    expect(out).toContain("<title>Shell title</title>");
  });
});
