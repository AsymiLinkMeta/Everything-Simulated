/**
 * sitemap.xml and llms.txt, generated from Supabase at build time.
 *
 * Nothing about products, prebuilds, prices, brands or compatibility is
 * written by hand here: those sections come from the database (anon key,
 * published rows only). Site structure, guides and city pages come from
 * src/lib/es/content.ts. Used by the es-seo-files plugin in vite.config.ts.
 */
import { BRAND, CITIES, GUIDES } from "../src/lib/es/content";

export type SeoCatalog = {
  prebuilds: { slug: string; name: string; updated_at: string | null; image: string | null; price_ex_gst: number | null; purchasable: boolean }[];
  products: { sku: string; name: string; brand: string; updated_at: string | null }[];
  ambassadors: SeoAmbassador[];
  blockRules: { left_sku: string; right_sku: string; reason: string }[];
  brands: string[];
};

export type SeoAmbassador = {
  slug: string;
  updated_at: string | null;
  name?: string;
  bio?: string | null;
  photo?: string | null;
  motorsport?: string | null;
  series?: string | null;
};

const SAFE_SLUG = /^[a-z0-9][a-z0-9-]{0,80}$/;

/**
 * Static HTML shell for /ambassadors/<slug>: the built index.html with the
 * profile's title, description, canonical and Open Graph tags, so link
 * previews (which don't run JavaScript) show the driver rather than the home
 * page. Returns null for slugs that aren't safe to use as a directory name.
 */
export function renderAmbassadorHtml(template: string, origin: string, a: SeoAmbassador): string | null {
  if (!SAFE_SLUG.test(a.slug) || !a.name) return null;
  const url = `${origin}/ambassadors/${a.slug}`;
  const title = `${a.name} | Ambassador | Everything Simulated`;
  const bio = (a.bio ?? "").replace(/\s+/g, " ").trim();
  const about = [a.motorsport, a.series].filter(Boolean).join(", ");
  const description = (bio || `${a.name}${about ? ` (${about})` : ""}, Everything Simulated ambassador. See their simulator and shop with their code.`).slice(0, 160);
  let image = `${origin}/og.jpg`;
  if (a.photo) {
    try {
      const u = new URL(a.photo, origin);
      if (u.protocol === "https:" || u.origin === origin) image = u.href;
    } catch {
      /* keep the default image */
    }
  }
  const set = (html: string, re: RegExp, value: string) => html.replace(re, (_m, pre: string, post: string) => `${pre}${esc(value)}${post}`);
  let out = template;
  out = out.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`);
  out = set(out, /(<meta name="description" content=")[^"]*(")/, description);
  out = set(out, /(<link rel="canonical" href=")[^"]*(")/, url);
  out = out.replace(/(<link rel="alternate" hreflang="[^"]+" href=")[^"]*(")/g, (_m, pre: string, post: string) => `${pre}${esc(url)}${post}`);
  out = set(out, /(<meta property="og:type" content=")[^"]*(")/, "profile");
  out = set(out, /(<meta property="og:url" content=")[^"]*(")/, url);
  out = set(out, /(<meta property="og:title" content=")[^"]*(")/, title);
  out = set(out, /(<meta property="og:description" content=")[^"]*(")/, description);
  out = set(out, /(<meta property="og:image" content=")[^"]*(")/, image);
  out = set(out, /(<meta name="twitter:title" content=")[^"]*(")/, title);
  out = set(out, /(<meta name="twitter:description" content=")[^"]*(")/, description);
  out = set(out, /(<meta name="twitter:image" content=")[^"]*(")/, image);
  return out;
}

/** Site structure. Product, prebuild and ambassador URLs are added from the database. */
export const STATIC_ROUTES: { path: string; priority: string; changefreq?: string }[] = [
  { path: "/", priority: "1.0", changefreq: "weekly" },
  { path: "/racing", priority: "0.95", changefreq: "weekly" },
  { path: "/aircraft", priority: "0.8" },
  { path: "/aircraft/helicopter", priority: "0.7" },
  { path: "/aircraft/flight", priority: "0.7" },
  { path: "/drones", priority: "0.8" },
  { path: "/training", priority: "0.8" },
  { path: "/training/driver", priority: "0.7" },
  { path: "/training/industrial", priority: "0.7" },
  { path: "/ambassadors", priority: "0.6" },
  { path: "/partners", priority: "0.6" },
  { path: "/prebuilds", priority: "0.9", changefreq: "weekly" },
  { path: "/shop", priority: "0.8", changefreq: "weekly" },
  { path: "/compatibility", priority: "0.8" },
  { path: "/events", priority: "0.7" },
  { path: "/studio", priority: "0.8" },
  { path: "/guides", priority: "0.8" },
  { path: "/faqs", priority: "0.8" },
  { path: "/au", priority: "0.8" },
  { path: "/contact", priority: "0.6" },
  { path: "/privacy", priority: "0.2" },
  { path: "/terms", priority: "0.2" },
];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const day = (iso: string | null | undefined, fallback: string) => (iso ? iso.slice(0, 10) : fallback);

function money(cents: number) {
  const dollars = cents / 100;
  return `$${dollars.toLocaleString("en-AU", { minimumFractionDigits: Number.isInteger(dollars) ? 0 : 2, maximumFractionDigits: 2 })}`;
}

export function renderSitemap(origin: string, data: SeoCatalog, today = new Date().toISOString().slice(0, 10)): string {
  const url = (path: string, opts: { lastmod?: string; priority?: string; changefreq?: string; image?: { loc: string; title: string } } = {}) => {
    const parts = [`<loc>${esc(origin + path)}</loc>`, `<lastmod>${opts.lastmod ?? today}</lastmod>`];
    if (opts.changefreq) parts.push(`<changefreq>${opts.changefreq}</changefreq>`);
    if (opts.priority) parts.push(`<priority>${opts.priority}</priority>`);
    if (opts.image) {
      parts.push(`<image:image><image:loc>${esc(opts.image.loc)}</image:loc><image:title>${esc(opts.image.title)}</image:title></image:image>`);
    }
    return `  <url>${parts.join("")}</url>`;
  };
  const abs = (src: string) => (/^https?:\/\//.test(src) ? src : origin + (src.startsWith("/") ? src : `/${src}`));
  const rows: string[] = [];
  for (const r of STATIC_ROUTES) {
    rows.push(url(r.path, { priority: r.priority, changefreq: r.changefreq, image: r.path === "/" ? { loc: `${origin}/og.jpg`, title: "Everything Simulated racing simulators" } : undefined }));
  }
  for (const p of data.prebuilds) {
    rows.push(url(`/prebuilds/${p.slug}`, { lastmod: day(p.updated_at, today), priority: "0.9", changefreq: "weekly", image: p.image ? { loc: abs(p.image), title: p.name } : undefined }));
  }
  for (const p of data.products) rows.push(url(`/shop/${encodeURIComponent(p.sku)}`, { lastmod: day(p.updated_at, today), priority: "0.6" }));
  for (const a of data.ambassadors) rows.push(url(`/ambassadors/${a.slug}`, { lastmod: day(a.updated_at, today), priority: "0.5" }));
  for (const g of GUIDES) rows.push(url(`/guides/${g.slug}`, { priority: "0.7" }));
  for (const c of CITIES) rows.push(url(`/au/${c.slug}`, { priority: "0.6" }));

  const seen = new Set<string>();
  const unique = rows.filter((r) => {
    const loc = r.match(/<loc>([^<]+)<\/loc>/)?.[1] ?? r;
    if (seen.has(loc)) return false;
    seen.add(loc);
    return true;
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ...unique,
    "</urlset>",
    "",
  ].join("\n");
}

export function renderLlms(origin: string, data: SeoCatalog): string {
  const prebuilds = data.prebuilds.length
    ? data.prebuilds
        .map((p) => {
          const price = p.purchasable && p.price_ex_gst ? `${money(p.price_ex_gst)} + GST` : "priced on enquiry";
          return `- ${p.name}: ${price}. ${origin}/prebuilds/${p.slug}`;
        })
        .join("\n")
    : "- No prebuilds are listed right now.";
  const facts = data.blockRules.length
    ? data.blockRules.map((r) => `- ${r.left_sku} + ${r.right_sku} is blocked: ${r.reason}`).join("\n")
    : "- See the live checker.";
  return `# Everything Simulated

> Gold Coast workshop that assembles simulator platforms and crate-freights them Australia-wide. Racing is the live catalogue (prebuilds, parts, compatibility checker). Aircraft, drones and training are consult-first platforms. Tickets stay in the customer app.

Website: ${origin}
Phone: ${BRAND.phone}
Email: ${BRAND.email}
Region: ${BRAND.region}, Australia
Currency: AUD, prices ex GST unless noted. Prices below are generated from the live catalogue at build time; the site is authoritative.

## Platforms

- Racing (live shop + checker): ${origin}/racing
- Aircraft (helicopter, fixed-wing): ${origin}/aircraft
- Drones: ${origin}/drones
- Training (driver, industrial): ${origin}/training
- Ambassadors (sponsored drivers): ${origin}/ambassadors
- Partners: ${origin}/partners

## Racing prebuilds (live catalogue)

Turn-key racing simulators, assembled and QA'd on the Gold Coast${data.brands.length ? `. Brands: ${data.brands.join(", ")}` : ""}.

${prebuilds}

Parts shop (${data.products.length} published parts): ${origin}/shop
Compatibility checker: ${origin}/compatibility
Studio demo (Gold Coast): ${origin}/studio
FAQs: ${origin}/faqs

## Hard compatibility facts (do not override)

- A build may only have one chassis, wheelbase, wheel, pedals, shifter, handbrake, motion, PC and seat.
${facts}
- Chat and AI may explain the checker. They cannot clear a block.

## Delivery

Every rig is assembled on the Gold Coast, photographed, then crate-freighted. Optional white-glove install in capital cities; SEQ install is standard. Lead time typically 3–6 weeks from deposit. A deposit secures the build; the balance is invoiced on QA.

Cities: ${CITIES.map((c) => c.name).join(", ")}: ${origin}/au

## Guides

${GUIDES.map((g) => `- ${g.title}: ${origin}/guides/${g.slug}`).join("\n")}

## Do not invent

No Xero. No invented SKUs, prices, stock, lead times, type ratings or CASA licences. Aircraft, drone and industrial platforms are consult-first; do not list a fake parts catalogue for them. Customer tickets stay in the app. Staff login is not a public page.
`;
}

/** Read the published catalogue through PostgREST with the anon key. */
export async function fetchSeoCatalog(supabaseUrl: string, anonKey: string): Promise<SeoCatalog> {
  const get = async <T>(path: string): Promise<T> => {
    const res = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/${path}`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`${path.split("?")[0]}: HTTP ${res.status} ${await res.text().catch(() => "")}`.trim());
    return (await res.json()) as T;
  };
  const [prebuilds, prices, products, ambassadors, rules, brands] = await Promise.all([
    get<{ id: string; slug: string; name: string; updated_at: string | null; image: string | null }[]>(
      "prebuilds?select=id,slug,name,updated_at,image&status=eq.published&order=sort_order",
    ),
    get<{ id: string; price_ex_gst: number | null; purchasable: boolean }[]>("prebuild_prices?select=id,price_ex_gst,purchasable"),
    get<{ sku: string; name: string; brand: string; updated_at: string | null }[]>(
      "catalog_products?select=sku,name,brand,updated_at&listing_status=eq.published&order=sku",
    ),
    get<SeoAmbassador[]>("ambassadors?select=slug,updated_at,name,bio,photo,motorsport,series&published=eq.true&order=sort_order"),
    get<{ left_sku: string; right_sku: string; reason: string }[]>(
      "compatibility_rules?select=left_sku,right_sku,reason&severity=eq.block&order=id",
    ),
    get<{ name: string }[]>("brands?select=name&order=sort_order"),
  ]);
  const priceById = new Map(prices.map((p) => [p.id, p]));
  return {
    prebuilds: prebuilds.map((p) => ({
      slug: p.slug,
      name: p.name,
      updated_at: p.updated_at,
      image: p.image,
      price_ex_gst: priceById.get(p.id)?.price_ex_gst ?? null,
      purchasable: Boolean(priceById.get(p.id)?.purchasable),
    })),
    products,
    ambassadors,
    blockRules: rules,
    brands: brands.map((b) => b.name).filter((n) => n && n !== "Everything Simulated"),
  };
}

export const EMPTY_CATALOG: SeoCatalog = { prebuilds: [], products: [], ambassadors: [], blockRules: [], brands: [] };
