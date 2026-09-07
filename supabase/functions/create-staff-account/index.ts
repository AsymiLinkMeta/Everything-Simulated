import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const STAFF_ROLES = ["sales", "workshop", "content", "support", "admin"] as const;
type StaffRole = (typeof STAFF_ROLES)[number];

type RequestBody = {
  email?: string;
  password?: string;
  displayName?: string;
  role?: StaffRole;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Sign in required" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: callerData } = await callerClient.auth.getUser();
    if (!callerData.user) return json({ error: "Sign in required" }, 401);

    const { data: callerProfile } = await callerClient
      .from("profiles")
      .select("role")
      .eq("user_id", callerData.user.id)
      .maybeSingle();
    if (callerProfile?.role !== "admin") return json({ error: "Admin access required" }, 403);

    const input = (await req.json()) as RequestBody;
    const email = input.email?.trim().toLowerCase();
    const password = input.password ?? "";
    const displayName = input.displayName?.trim() ?? "";
    const role = input.role;

    if (!email || !email.includes("@") || email.length > 254) return json({ error: "Enter a valid email address" }, 400);
    if (password.length < 8 || password.length > 128) return json({ error: "Password must be 8 to 128 characters" }, 400);
    if (!displayName || displayName.length > 80) return json({ error: "Enter a display name" }, 400);
    if (!role || !STAFF_ROLES.includes(role)) return json({ error: "Choose a valid staff role" }, 400);
    if (!serviceRoleKey) return json({ error: "Account service unavailable" }, 503);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    });
    if (createError || !created.user) return json({ error: "Could not create account" }, 400);

    const { error: profileError } = await adminClient.from("profiles").insert({
      user_id: created.user.id,
      email,
      display_name: displayName,
      role,
    });
    if (profileError) {
      await adminClient.auth.admin.deleteUser(created.user.id);
      return json({ error: "Could not finish staff account setup" }, 500);
    }

    return json({ userId: created.user.id, email, displayName, role });
  } catch {
    return json({ error: "Could not create staff account" }, 500);
  }
});
