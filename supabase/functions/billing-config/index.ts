const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve((req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  const stripe = Boolean(Deno.env.get("STRIPE_SECRET_KEY"));
  const mail = Boolean(Deno.env.get("RESEND_API_KEY"));
  const depositPercent = Number(Deno.env.get("DEPOSIT_PERCENT") ?? "30") || 30;
  return new Response(JSON.stringify({ stripe, mail, depositPercent }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
