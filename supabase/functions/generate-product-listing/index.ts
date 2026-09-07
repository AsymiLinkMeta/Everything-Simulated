import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type RequestBody = {
  brand?: string;
  productName?: string;
  category?: string;
  price?: string;
  details?: string;
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
};

function fallbackListing(input: RequestBody): Listing {
  const brand = input.brand?.trim() || "New brand";
  const name = input.productName?.trim() || "New catalogue product";
  const category = input.category?.trim() || "accessory";
  const slug = `${brand}-${name}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 38);
  const price = Math.max(0, Math.round(Number(input.price || 0) * 100));
  const details = input.details?.trim() || "A carefully selected addition to the Everything Simulated catalogue.";

  return {
    sku: slug || "new-product",
    brand,
    name,
    category,
    price,
    stockStatus: "indent",
    leadWeeksMin: 2,
    leadWeeksMax: 6,
    description: `${name} from ${brand}. ${details}`,
    notes: "Review price, stock status, compatibility, and lead time before publishing.",
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
    const fallback = fallbackListing(input);
    const apiKey = Deno.env.get("XAI_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ listing: fallback, source: "draft" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "grok-4.5",
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You create concise, accurate sim-racing retail catalogue listings for Everything Simulated in Australia. Return only JSON with sku, brand, name, category, price (integer cents), stockStatus (stock|indent|discontinued), leadWeeksMin, leadWeeksMax, description, and notes. Never invent technical compatibility claims. Keep SKU lowercase kebab-case and under 48 characters.",
          },
          { role: "user", content: JSON.stringify(input) },
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
    const listing = isListing(parsed) ? parsed : fallback;

    return new Response(JSON.stringify({ listing, source: isListing(parsed) ? "grok" : "draft" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Could not generate a product listing" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
