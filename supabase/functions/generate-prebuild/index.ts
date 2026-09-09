import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type RequestBody = {
  prompt?: string;
  catalogSkus?: string[];
};

type PrebuildDraft = {
  name: string;
  slug: string;
  kicker: string;
  blurb: string;
  description: string;
  price_ex_gst: number;
  highlights: string[];
  specs: Record<string, string>;
  capabilities: string[];
  components: { sku: string; qty: number }[];
};

function fallbackDraft(prompt: string, skus: string[]): PrebuildDraft {
  const name = prompt.slice(0, 40).trim() || "New Prebuild";
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
  return {
    name,
    slug,
    kicker: "Custom",
    blurb: "AI-generated prebuild draft. Review and edit before publishing.",
    description: "Review and expand this description before publishing.",
    price_ex_gst: 0,
    highlights: [],
    specs: {},
    capabilities: [],
    components: skus.slice(0, 5).map((sku) => ({ sku, qty: 1 })),
  };
}

function isDraft(value: unknown): value is PrebuildDraft {
  if (!value || typeof value !== "object") return false;
  const d = value as Partial<PrebuildDraft>;
  return (
    typeof d.name === "string" &&
    typeof d.slug === "string" &&
    typeof d.blurb === "string" &&
    typeof d.price_ex_gst === "number"
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
    if (!profile || !["sales", "content", "admin", "workshop", "support"].includes(profile.role)) {
      return new Response(JSON.stringify({ error: "Staff access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const input = (await req.json()) as RequestBody;
    if (!input.prompt?.trim()) {
      return new Response(JSON.stringify({ error: "A prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const skus = input.catalogSkus ?? [];

    const apiKey = Deno.env.get("XAI_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ draft: fallbackDraft(input.prompt, skus), source: "fallback" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are a sim-racing prebuilt-rig specialist for Everything Simulated, an Australian company on the Gold Coast. Your job is to generate a COMPLETE prebuilt simulator draft from a staff member's text prompt.

CRITICAL RULES:
1. Return ONLY valid JSON — no markdown, no commentary.
2. Only use SKUs from the provided catalogue list. Never invent SKUs.
3. Price is in AUD cents ex GST. Set 0 if the prompt doesn't specify a price.
4. All text should be written for Australian sim racers — premium, practical, no hype.

REQUIRED JSON fields:
- name: display name, e.g. "Starter Rig"
- slug: lowercase kebab-case URL path, under 48 chars
- kicker: short badge label, e.g. "Entry Level" or "Pro"
- blurb: 1-2 sentence card description
- description: 2-4 paragraph rich description for the detail page
- price_ex_gst: integer cents, or 0 if not specified
- highlights: array of 3-6 short selling-point strings
- specs: object of key-value spec pairs, e.g. {"Wheelbase": "Simagic Alpha", "Torque": "15 Nm"}
- capabilities: array of 3-6 capability strings
- components: array of {sku, qty} using ONLY the provided catalogue SKUs

If the prompt is vague, make reasonable choices based on the available SKUs. Prefer complete builds (chassis, wheelbase, wheel, pedals, seat, monitor).`;

    const userContent = JSON.stringify({
      prompt: input.prompt,
      availableSkus: skus,
    });

    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "grok-4.5",
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ draft: fallbackDraft(input.prompt, skus), source: "fallback" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error("Missing model response");
    const parsed: unknown = JSON.parse(content);

    if (isDraft(parsed)) {
      // Filter components to only valid SKUs
      const validSkus = new Set(skus);
      parsed.components = (parsed.components ?? []).filter((c) => validSkus.has(c.sku) || !skus.length);
      return new Response(JSON.stringify({ draft: parsed, source: "grok" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ draft: fallbackDraft(input.prompt, skus), source: "fallback" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Could not generate a prebuild draft" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
