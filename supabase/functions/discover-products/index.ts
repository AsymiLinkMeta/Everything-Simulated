import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SOURCES = [
  { id: "simagic", name: "Simagic", origin: "https://simagic.com" },
  { id: "trak-racer", name: "Trak Racer AU", origin: "https://www.trakracer.com.au" },
  { id: "simrigs", name: "SIMRIG / Exodus", origin: "https://simrigs.com.au" },
];

const UA = "EverythingSimulated/1.0 (+https://www.everythingsimulated.com.au)";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isPublicHttpUrl(value: string) {
  try {
    const u = new URL(value);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local") || host === "0.0.0.0") return false;
    if (/^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

function shopifyOrigin(url: URL) {
  return `${url.protocol}//${url.host}`;
}

type RichProduct = {
  key: string;
  title: string;
  brand: string;
  vendor: string;
  url: string;
  handle: string;
  sku: string | null;
  image: string | null;
  images: string[];
  bodyHtml: string;
  bodyText: string;
  productType: string;
  tags: string[];
  variants: { sku?: string; title?: string; price?: string }[];
  options: { name: string; values: string[] }[];
};

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function mapShopifyProduct(p: Record<string, unknown>, origin: string, brand?: string): RichProduct {
  const handle = String(p.handle ?? "");
  const rawImages = Array.isArray(p.images)
    ? p.images.map((img) => {
        if (typeof img === "string") return img;
        if (typeof img === "object" && img !== null) return String((img as { src?: string }).src ?? "");
        return "";
      }).filter(Boolean)
    : p.image
      ? [typeof p.image === "string" ? p.image : String((p.image as { src?: string }).src ?? "")]
      : [];
  const variants = Array.isArray(p.variants)
    ? (p.variants as Record<string, unknown>[]).map((v) => ({
        sku: v.sku ? String(v.sku) : undefined,
        title: v.title ? String(v.title) : undefined,
        price: v.price ? String(v.price) : undefined,
      }))
    : [];
  const options = Array.isArray(p.options)
    ? (p.options as Record<string, unknown>[]).map((o) => ({
        name: String(o.name ?? ""),
        values: Array.isArray(o.values) ? (o.values as string[]).map(String) : [],
      }))
    : [];
  const bodyHtml = String(p.body_html ?? p.description ?? "");
  const sku = variants.find((v) => v.sku)?.sku ?? null;
  const tags = String(p.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean);
  const productUrl = `${origin}/products/${handle}`;

  return {
    key: productUrl,
    title: String(p.title ?? handle),
    brand: String(p.vendor ?? brand ?? ""),
    vendor: String(p.vendor ?? ""),
    url: productUrl,
    handle,
    sku,
    image: rawImages[0] || null,
    images: rawImages,
    bodyHtml,
    bodyText: stripHtml(bodyHtml),
    productType: String(p.product_type ?? ""),
    tags,
    variants,
    options,
  };
}

async function fetchJson(url: string) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, redirect: "follow" });
  if (!res.ok) throw new Error("fetch failed");
  return res.json();
}

async function searchSources(query: string) {
  const q = query.toLowerCase();
  const hits: RichProduct[] = [];
  for (const source of SOURCES) {
    try {
      const body = (await fetchJson(`${source.origin}/products.json?limit=250`)) as { products?: Record<string, unknown>[] };
      for (const p of body.products ?? []) {
        const mapped = mapShopifyProduct(p, source.origin, source.name);
        const blob = `${mapped.title} ${mapped.sku ?? ""} ${mapped.handle} ${mapped.vendor} ${mapped.tags.join(" ")}`.toLowerCase();
        if (blob.includes(q) || q.split(/\s+/).every((part) => blob.includes(part))) hits.push(mapped);
      }
    } catch {
      /* skip a source that is down */
    }
  }
  return hits.slice(0, 24);
}

async function readPage(urlStr: string) {
  const url = new URL(urlStr);
  const origin = shopifyOrigin(url);
  const collection = url.pathname.match(/\/collections\/([^/?#]+)/);
  const product = url.pathname.match(/\/products\/([^/?#]+)/);

  if (collection) {
    try {
      const body = (await fetchJson(`${origin}/collections/${collection[1]}/products.json?limit=50`)) as {
        products?: Record<string, unknown>[];
      };
      const products = (body.products ?? []).map((p) => mapShopifyProduct(p, origin));
      if (products.length) return { kind: "collection" as const, products };
    } catch {
      /* fall through to HTML */
    }
  }

  if (product) {
    try {
      const p = (await fetchJson(`${origin}/products/${product[1]}.js`)) as Record<string, unknown>;
      return { kind: "product" as const, products: [mapShopifyProduct(p, origin)] };
    } catch {
      /* fall through */
    }
  }

  // HTML fallback — extract product links and try to get Shopify JSON for each
  const res = await fetch(urlStr, { headers: { "User-Agent": UA }, redirect: "follow" });
  if (!res.ok) throw new Error("Could not read that URL");
  const html = (await res.text()).slice(0, 180_000);
  const links = [...html.matchAll(/href=["']([^"']*\/products\/[^"'?#]+)/gi)].map((m) => {
    try {
      return new URL(m[1], origin).toString();
    } catch {
      return "";
    }
  });
  const uniqueUrls = [...new Set(links.filter(Boolean))].slice(0, 16);

  const products: RichProduct[] = [];
  for (const href of uniqueUrls) {
    const handle = href.split("/products/")[1]?.split("/")[0] ?? href;
    // Try Shopify JSON endpoint first for rich data
    try {
      const shopOrigin = new URL(href);
      const richBody = (await fetchJson(`${shopOrigin.origin}/products/${handle}.js`)) as Record<string, unknown>;
      products.push(mapShopifyProduct(richBody, shopOrigin.origin));
    } catch {
      products.push({
        key: href,
        title: handle.replace(/-/g, " "),
        brand: url.hostname,
        vendor: url.hostname,
        url: href,
        handle,
        sku: null,
        image: null,
        images: [],
        bodyHtml: "",
        bodyText: "",
        productType: "",
        tags: [],
        variants: [],
        options: [],
      });
    }
  }
  return { kind: products.length > 1 ? ("collection" as const) : ("product" as const), products };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Sign in required" }, 401);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return json({ error: "Sign in required" }, 401);
    const { data: profile } = await supabase.from("profiles").select("role").eq("user_id", userData.user.id).maybeSingle();
    if (!profile || !["sales", "workshop", "content", "support", "admin"].includes(profile.role)) {
      return json({ error: "Staff access required" }, 403);
    }

    const input = (await req.json()) as { query?: string; url?: string };
    const url = input.url?.trim();
    const query = input.query?.trim();
    if (url) {
      if (!isPublicHttpUrl(url)) return json({ error: "Use a public http(s) URL" }, 400);
      const page = await readPage(url);
      return json(page);
    }
    if (query) {
      const products = await searchSources(query);
      return json({ kind: "search", products });
    }
    return json({ error: "Provide a SKU/query or a manufacturer URL" }, 400);
  } catch {
    return json({ error: "Could not read manufacturer catalogue" }, 500);
  }
});
