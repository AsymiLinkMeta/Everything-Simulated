import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function createAdminClient() {
  const key = supabaseServiceKey ?? supabaseAnonKey;
  return createClient(supabaseUrl!, key!, {
    auth: { persistSession: false },
  });
}

export const adminClient = createAdminClient();

export function createAuthedClient(accessToken: string) {
  return createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export { supabaseUrl, supabaseAnonKey };
