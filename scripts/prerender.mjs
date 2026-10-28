#!/usr/bin/env node
/**
 * Build-time prerender (static HTML) for the public pages. Runs after `vite build`.
 *
 * 1. Builds src/entry-prerender.tsx as an SSR bundle and renders every route in
 *    PRERENDER_ROUTES (site structure, guides and city pages, the same list the
 *    sitemap uses) to dist/<route>.html, with the head tags the route's head()
 *    sets in the browser (title, description, robots, canonical, hreflang, Open
 *    Graph, Twitter) and the rendered page inside #root. HEAD_ONLY_ROUTES (live
 *    catalogue listings) get the head tags with an empty #root.
 * 2. Keeps the untouched app shell as dist/spa.html for the client-rendered
 *    catalogue URLs (/shop/<sku>, /prebuilds/<slug>, ...) and the portals, and
 *    points the generated _redirects rewrites at it. Prerendered pages are served
 *    from their own files.
 * 3. Writes dist/404.html (the not-found page, noindex, no canonical) for the
 *    `/*` 404 catch-all.
 *
 * The browser still mounts the app with createRoot(); while a page's lazy chunk
 * loads it shows the prerendered page rather than "Loading…" (src/lib/prerender.ts).
 * The build fails if a page renders without a title, description, self-canonical
 * or <h1>, or if a render throws.
 */
import { readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const ssrOut = join(root, "dist-ssr");
const log = (...a) => console.log("[prerender]", ...a);

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Replace the template's tag for this key, or add it before </head>. */
function upsert(html, re, tag) {
  return re.test(html) ? html.replace(re, tag) : html.replace("</head>", `    ${tag}\n  </head>`);
}

/** The head() payload ({ meta: [...], links: [...] }) applied to the shell, like applyHeadPayload() does in the browser. */
export function applyHead(template, head, { url, noindex }) {
  let html = template;
  let title = "";
  let description = "";
  const has = new Set();
  for (const m of head?.meta ?? []) {
    if (m.title) {
      title = m.title;
      html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(m.title)}</title>`);
    } else if (m.name && m.content) {
      has.add(`name:${m.name}`);
      if (m.name === "description") description = m.content;
      html = upsert(html, new RegExp(`<meta\\s+name="${reEsc(m.name)}"[^>]*>`), `<meta name="${esc(m.name)}" content="${esc(m.content)}" />`);
    } else if (m.property && m.content) {
      has.add(`property:${m.property}`);
      html = upsert(html, new RegExp(`<meta\\s+property="${reEsc(m.property)}"[^>]*>`), `<meta property="${esc(m.property)}" content="${esc(m.content)}" />`);
    }
  }
  const defaults = [
    ["property", "og:title", title],
    ["property", "og:description", description],
    ["property", "og:url", url],
    ["name", "twitter:title", title],
    ["name", "twitter:description", description],
  ];
  for (const [attr, key, value] of defaults) {
    if (!value || has.has(`${attr}:${key}`)) continue;
    html = upsert(html, new RegExp(`<meta\\s+${attr}="${reEsc(key)}"[^>]*>`), `<meta ${attr}="${key}" content="${esc(value)}" />`);
  }
  let canonical = null;
  for (const l of head?.links ?? []) {
    if (!l.rel || !l.href) continue;
    const hreflang = l.hreflang || l.hrefLang;
    if (hreflang) {
      html = upsert(html, new RegExp(`<link\\s+rel="${reEsc(l.rel)}"\\s+hreflang="${reEsc(hreflang)}"[^>]*>`), `<link rel="${esc(l.rel)}" hreflang="${esc(hreflang)}" href="${esc(l.href)}" />`);
    } else if (l.rel === "canonical") {
      canonical = l.href;
    }
  }
  if (!canonical) canonical = url;
  if (noindex) {
    html = html.replace(/\s*<link\s+rel="canonical"[^>]*>/, "").replace(/\s*<link\s+rel="alternate"\s+hreflang="[^"]*"[^>]*>/g, "");
    html = html.replace(/\s*<meta\s+property="og:url"[^>]*>/, "");
  } else {
    html = upsert(html, /<link\s+rel="canonical"[^>]*>/, `<link rel="canonical" href="${esc(canonical)}" />`);
  }
  return { html, title, description, canonical: noindex ? null : canonical };
}

const fileFor = (route) => (route === "/" ? "index.html" : `${route.replace(/^\//, "")}.html`);

async function write(rel, body) {
  const file = join(dist, rel);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, body);
}

function withBody(html, body, route) {
  if (!html.includes('<div id="root"></div>')) throw new Error('[prerender] template has no empty <div id="root"></div>');
  return html.replace('<div id="root"></div>', `<div id="root" data-prerendered="${esc(route)}">${body}</div>`);
}

/** _redirects from the client build: prerendered pages are served from their files, everything else from the shell. */
export function rewriteRedirects(redirects, prerendered) {
  const set = new Set(prerendered);
  const out = [];
  for (const line of redirects.split("\n")) {
    const m = line.match(/^(\S+)(\s+)\/index\.html(\s+)(200|404)\s*$/);
    if (!m) {
      out.push(line);
      continue;
    }
    const [, from, gap1, gap2, status] = m;
    if (status === "404") out.push(`${from}${gap1}/404.html${gap2}404`);
    else if (!set.has(from)) out.push(`${from}${gap1}/spa.html${gap2}${status}`);
  }
  return `${out.join("\n").trimEnd()}\n`;
}

/**
 * The SPA shell serves many URLs (product pages, account screens), so its static head must not
 * claim to be the home page: drop the canonical, hreflang and og:url. The app sets the right ones
 * once the route renders.
 */
export function shellHtml(template) {
  return template
    .replace(/\s*<link\s+rel="canonical"[^>]*>/, "")
    .replace(/\s*<link\s+rel="alternate"\s+hreflang="[^"]*"[^>]*>/g, "")
    .replace(/\s*<meta\s+property="og:url"[^>]*>/, "");
}

async function main() {
  const template = await readFile(join(dist, "index.html"), "utf8");
  await write("spa.html", shellHtml(template));

  await build({
    root,
    logLevel: "warn",
    mode: process.env.NODE_ENV === "development" ? "development" : "production",
    build: { ssr: "src/entry-prerender.tsx", outDir: ssrOut, emptyOutDir: true, copyPublicDir: false, minify: false },
  });
  const app = await import(pathToFileURL(join(ssrOut, "entry-prerender.js")).href);
  const { ORIGIN, PRERENDER_ROUTES, HEAD_ONLY_ROUTES = [], NOT_FOUND_PATH, render } = app;
  const headOnly = new Set(HEAD_ONLY_ROUTES);
  const noindexSite = process.env.VITE_NOINDEX === "true";

  const titles = new Map();
  for (const route of PRERENDER_ROUTES) {
    const { html: body, head } = await render(route);
    const url = ORIGIN + route;
    const page = applyHead(template, head, { url, noindex: false });
    const problems = [];
    if (!head) problems.push("route set no head()");
    if (!page.title) problems.push("no title");
    if (!page.description) problems.push("no meta description");
    if (page.canonical !== url) problems.push(`canonical ${page.canonical} != ${url}`);
    if (!headOnly.has(route) && !/<h1[\s>]/i.test(body)) problems.push("no <h1>");
    const robots = (head?.meta ?? []).find((m) => m.name === "robots")?.content ?? "";
    if (/noindex/.test(robots) && !noindexSite) problems.push("rendered as noindex");
    if (problems.length) throw new Error(`[prerender] ${route}: ${problems.join(", ")}`);
    if (titles.has(page.title)) log(`WARNING: ${route} has the same title as ${titles.get(page.title)}`);
    titles.set(page.title, route);
    await write(fileFor(route), headOnly.has(route) ? page.html : withBody(page.html, body, route));
  }
  log(`${PRERENDER_ROUTES.length - headOnly.size} pages prerendered, ${headOnly.size} with head tags only (${[...headOnly].join(", ")})`);

  const nf = await render(NOT_FOUND_PATH);
  const nfPage = applyHead(template, nf.head, { url: ORIGIN + NOT_FOUND_PATH, noindex: true });
  await write("404.html", withBody(nfPage.html, nf.html, "*"));

  const redirects = await readFile(join(dist, "_redirects"), "utf8");
  await write("_redirects", rewriteRedirects(redirects, PRERENDER_ROUTES));

  await rm(ssrOut, { recursive: true, force: true });
}

// Run only as a script (tests import the helpers above).
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
