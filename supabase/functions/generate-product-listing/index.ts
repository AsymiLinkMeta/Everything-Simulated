import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type DiscoveredProduct = {
  key?: string;
  title?: string;
  brand?: string;
  url?: string;
  sku?: string | null;
  image?: string | null;
  images?: string[];
  bodyHtml?: string;
  bodyText?: string;
  productType?: string;
  tags?: string[];
  variants?: { sku?: string; title?: string; price?: string }[];
  options?: { name: string; values: string[] }[];
};

type RequestBody = {
  brand?: string;
  productName?: string;
  category?: string;
  price?: string;
  details?: string;
  url?: string;
  discovered?: DiscoveredProduct;
};

type Listing = {
  sku: string;
  brand: string;
  name: string;
  category: string;
  price: number;
  stockStatus: "stock" | "indent" | "discontinued";
  leadWeeksMin: number;
  leadWeeksMax: number;
  description: string;
  notes: string;
  imageUrl?: string;
  images?: string[];
  manufacturerUrl?: string;
  whatsIncluded?: string[];
  mountCompatibility?: string;
  assemblyManualUrl?: string;
  specs?: Record<string, string>;
  compare?: string;
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

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
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function fallbackListing(input: RequestBody, discovered?: DiscoveredProduct): Listing {
  const brand = (input.brand?.trim() || discovered?.brand?.trim() || "New brand").trim();
  const name = (input.productName?.trim() || discovered?.title?.trim() || "New catalogue product").trim();
  const category = (input.category?.trim() || "accessory").trim();
  const slug = slugify(`${brand}-${name}`) || "new-product";

  const discImages = discovered?.images?.filter(Boolean) ?? [];
  const discImage = discovered?.image ?? discImages[0] ?? undefined;

  const details = input.details?.trim() || discovered?.bodyText?.slice(0, 500) || "";
  const description = details
    ? `${name} from ${brand}. ${details}`
    : `${name} from ${brand}. A carefully selected addition to the Everything Simulated catalogue.`;

  // Try to extract specs from discovered product tags/options
  const specs: Record<string, string> = {};
  if (discovered?.productType) specs["Type"] = discovered.productType;
  if (discovered?.options) {
    for (const opt of discovered.options) {
      if (opt.name && opt.values.length) specs[opt.name] = opt.values.join(", ");
    }
  }
  if (discovered?.tags?.length) specs["Tags"] = discovered.tags.join(", ");

  return {
    sku: discovered?.sku || slug,
    brand,
    name,
    category,
    price: 0,
    stockStatus: "indent",
    leadWeeksMin: 2,
    leadWeeksMax: 6,
    description,
    notes: "AI autofill generated this draft. Review all fields and set a price before publishing.",
    imageUrl: discImage,
    images: discImages.length ? discImages : discImage ? [discImage] : [],
    manufacturerUrl: input.url?.trim() || discovered?.url || undefined,
    whatsIncluded: [],
    mountCompatibility: "",
    assemblyManualUrl: undefined,
    specs: Object.keys(specs).length ? specs : {},
    compare: "",
  };
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

async function readProductPage(url: string) {
  const res = await fetch(url, { redirect: "follow", headers: { "User-Agent": "EverythingSimulatedBot/1.0" } });
  if (!res.ok) throw new Error("Could not read that URL");
  const html = (await res.text()).slice(0, 200_000);

  const title = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i)?.[1]
    || html.match(/<title[^>]*>([^<]+)/i)?.[1]
    || "";
  const description = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)/i)?.[1]
    || html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i)?.[1]
    || "";
  const ogImages = [...html.matchAll(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/gi)].map((m) => m[1]);
  const moreImages = [...html.matchAll(/<img[^>]+src=["'](https?:\/\/[^"']+)/gi)].map((m) => m[1]);
  const manualLinks = [...html.matchAll(/<a[^>]+href=["']([^"']+(?:manual|guide|assembly|instruction)[^"']*)["'][^>]*>([^<]*)/gi)].map((m) => m[1]);

  // Extract spec tables/lists from HTML
  const specSections: string[] = [];
  const specTableMatches = [...html.matchAll(/<(?:table|dl|ul)[^>]*(?:spec|feature|tech|detail|attribute)[^>]*>([\s\S]*?)<\/(?:table|dl|ul)>/gi)];
  for (const m of specTableMatches) {
    specSections.push(stripHtml(m[1]).slice(0, 2000));
  }

  // Extract "what's in the box" sections
  const boxMatches = [...html.matchAll(/(?:what.?s?\s*in\s*(?:the\s*)?box|in\s*the\s*box|includes?|package\s*contents?)[\s\S]{0,2000}?(?:<\/(?:div|section|ul|ol)>)/i)];
  const boxText = boxMatches.map((m) => stripHtml(m[0]).slice(0, 1000)).filter(Boolean);

  // Extract compatibility sections
  const compatMatches = [...html.matchAll(/(?:compatib(?:le|ility)|mounts?\s*(?:with|to)?|fits?)[\s\S]{0,2000}?(?:<\/(?:div|section|ul|ol|p)>)/i)];
  const compatText = compatMatches.map((m) => stripHtml(m[0]).slice(0, 1000)).filter(Boolean);

  const text = stripHtml(html).slice(0, 80_000);

  return {
    title: title.trim(),
    description: description.trim(),
    images: [...new Set([...ogImages, ...moreImages])].slice(0, 12),
    manualLinks: [...new Set(manualLinks)].slice(0, 4),
    specSections,
    boxText,
    compatText,
    bodyText: text,
  };
}

function isListing(value: unknown): value is Listing {
  if (!value || typeof value !== "object") return false;
  const listing = value as Partial<Listing>;
  return Boolean(
    typeof listing.sku === "string" &&
      typeof listing.brand === "string" &&
      typeof listing.name === "string" &&
      typeof listing.category === "string" &&
      typeof listing.price === "number" &&
      typeof listing.description === "string" &&
      typeof listing.notes === "string",
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Sign in required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return new Response(JSON.stringify({ error: "Sign in required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (!profile || !["sales", "content", "admin"].includes(profile.role)) {
      return new Response(JSON.stringify({ error: "Staff access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const input = (await req.json()) as RequestBody;
    const discovered = input.discovered;

    // Use discovered product data if available, otherwise scrape the URL
    let pageData: {
      title: string;
      description: string;
      images: string[];
      manualLinks: string[];
      specSections: string[];
      boxText: string[];
      compatText: string[];
      bodyText: string;
    } | null = null;

    if (discovered?.bodyText) {
      // We already have rich Shopify data from discover-products
      pageData = {
        title: discovered.title ?? "",
        description: discovered.bodyText.slice(0, 500),
        images: discovered.images ?? (discovered.image ? [discovered.image] : []),
        manualLinks: [],
        specSections: [],
        boxText: [],
        compatText: [],
        bodyText: discovered.bodyText,
      };
      if (!input.productName && discovered.title) input.productName = discovered.title;
      if (!input.brand && discovered.brand) input.brand = discovered.brand;
      if (!input.details && discovered.bodyText) input.details = discovered.bodyText.slice(0, 500);
    }

    // Also try scraping the URL for additional data (spec tables, manuals, box contents)
    if (input.url && isPublicHttpUrl(input.url.trim())) {
      try {
        const scraped = await readProductPage(input.url.trim());
        if (!pageData) {
          pageData = scraped;
          if (!input.productName && scraped.title) input.productName = scraped.title;
          if (!input.details && scraped.description) input.details = scraped.description;
        } else {
          // Merge: supplement discovered data with scraped spec sections, manuals, box text
          pageData.specSections = [...pageData.specSections, ...scraped.specSections];
          pageData.manualLinks = [...pageData.manualLinks, ...scraped.manualLinks];
          pageData.boxText = [...pageData.boxText, ...scraped.boxText];
          pageData.compatText = [...pageData.compatText, ...scraped.compatText];
          pageData.images = [...new Set([...pageData.images, ...scraped.images])].slice(0, 12);
          if (pageData.bodyText.length < scraped.bodyText.length) {
            pageData.bodyText = scraped.bodyText;
          }
        }
      } catch {
        // keep whatever we have from discovered
      }
    }

    const fallback = fallbackListing(input, discovered);
    if (pageData?.images.length) {
      fallback.images = [...new Set([...(fallback.images ?? []), ...pageData.images])].slice(0, 8);
      fallback.imageUrl = fallback.images[0] ?? pageData.images[0];
    }
    if (pageData?.manualLinks.length) {
      fallback.assemblyManualUrl = pageData.manualLinks[0];
    }

    const apiKey = Deno.env.get("XAI_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ listing: fallback, source: "draft" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const discoveredContext = discovered
      ? {
          title: discovered.title,
          brand: discovered.brand,
          sku: discovered.sku,
          vendor: discovered.brand,
          productType: discovered.productType,
          tags: discovered.tags,
          variants: discovered.variants,
          options: discovered.options,
          bodyHtml: discovered.bodyHtml?.slice(0, 30_000),
          bodyText: discovered.bodyText?.slice(0, 30_000),
          images: discovered.images,
        }
      : undefined;

    const pageContext = pageData
      ? {
          title: pageData.title,
          description: pageData.description,
          images: pageData.images,
          manualLinks: pageData.manualLinks,
          specSections: pageData.specSections,
          boxContents: pageData.boxText,
          compatibilitySections: pageData.compatText,
          bodyText: pageData.bodyText.slice(0, 40_000),
        }
      : undefined;

    const systemPrompt = `You are a sim-racing retail catalogue specialist for Everything Simulated in Australia. Your job is to generate a COMPLETE product listing from the manufacturer data provided. You must populate as many fields as possible.

CRITICAL RULES:
1. Price MUST ALWAYS be 0. Pricing is set by admins — never set a price from the manufacturer page.
2. Return ONLY valid JSON — no markdown, no commentary.
3. Never fabricate specifications, compatibility, or features that are not in the source data. If a field has no source data, use an empty string or empty array.
4. Extract every detail you can from the provided manufacturer page content, discovered product data, spec tables, and body text.

REQUIRED JSON fields:
- sku: lowercase kebab-case, under 48 chars. Use the manufacturer SKU if available, otherwise derive from brand+name.
- brand: the manufacturer brand name
- name: the full product name
- category: one of: chassis, wheelbase, wheel, pedals, shifter, handbrake, seat, motion, monitor, mount, pc, audio, headset, software, adapter, accessory
- price: ALWAYS 0 (admins set pricing)
- stockStatus: "indent" unless clearly in stock
- leadWeeksMin: integer weeks (default 2 if unknown)
- leadWeeksMax: integer weeks (default 6 if unknown)
- description: rich marketing copy (2-4 paragraphs) based on the manufacturer page — tell the product story, highlight key features, materials, and use cases. Write for Australian sim racers.
- notes: staff-only review notes noting what to verify before publishing
- imageUrl: first product image URL
- images: array of all product image URLs found
- manufacturerUrl: the source URL
- whatsIncluded: array of items included in the box — extract from "what's in the box" sections, package contents, or product description
- mountCompatibility: which wheel bases, pedal sets, seats, monitors, or chassis this product mounts to or is compatible with — only from source data
- assemblyManualUrl: link to a manual/guide/assembly PDF if found on the page
- specs: object of key-value spec pairs extracted from spec tables, tech specs, or product descriptions, e.g. {"Material": "Extruded aluminium", "Profile": "40x120mm", "Weight": "28kg"}
- compare: a short paragraph (2-3 sentences) comparing this product to alternatives in its category — based only on factual attributes from the source

If the source data is thin, still populate sku, brand, name, category, description (from whatever text is available), and set price to 0. Do not leave fields undefined if you can derive them.`;

    const userContent = JSON.stringify({
      input: {
        brand: input.brand,
        productName: input.productName,
        category: input.category,
        details: input.details,
        url: input.url,
      },
      discovered: discoveredContext,
      page: pageContext,
    });

    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "grok-4.5",
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ listing: fallback, source: "draft" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error("Missing model response");
    const parsed: unknown = JSON.parse(content);

    if (isListing(parsed)) {
      // Force price to 0 regardless of what the AI returned
      parsed.price = 0;
      // Merge images from page/discovered if AI didn't return any
      if ((!parsed.images || parsed.images.length === 0) && fallback.images?.length) {
        parsed.images = fallback.images;
        parsed.imageUrl = fallback.imageUrl;
      }
      // Ensure manufacturerUrl is set
      if (!parsed.manufacturerUrl) {
        parsed.manufacturerUrl = input.url?.trim() || discovered?.url || undefined;
      }
      return new Response(JSON.stringify({ listing: parsed, source: "grok" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ listing: fallback, source: "draft" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Could not generate a product listing" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
