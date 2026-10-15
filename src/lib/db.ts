/**
 * Supabase client, assembled from the three parts this app uses (PostgREST, Auth,
 * Functions) instead of the full supabase-js bundle, which also ships Realtime and
 * Storage (about 25 KB gzipped we never call). Behaviour matches createClient():
 * same session storage key, implicit flow, and the signed-in user's JWT (or the anon
 * key) on every REST and Functions request.
 */
import { PostgrestClient } from "@supabase/postgrest-js";
import { AuthClient } from "@supabase/auth-js";
import { FunctionsClient } from "@supabase/functions-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseUrl = url;
export const supabaseAnonKey = anonKey;

const base = new URL(url.endsWith("/") ? url : `${url}/`);
const CLIENT_INFO = { "X-Client-Info": "es-web/slim-supabase" };

const auth = new AuthClient({
  url: new URL("auth/v1", base).href,
  headers: { Authorization: `Bearer ${anonKey}`, apikey: anonKey, ...CLIENT_INFO },
  storageKey: `sb-${base.hostname.split(".")[0]}-auth-token`,
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: true,
  flowType: "implicit",
});

const fetchWithAuth: typeof fetch = async (input, init) => {
  const { data } = await auth.getSession();
  const headers = new Headers(init?.headers);
  if (!headers.has("apikey")) headers.set("apikey", anonKey);
  if (!headers.has("Authorization")) headers.set("Authorization", `Bearer ${data.session?.access_token ?? anonKey}`);
  return fetch(input, { ...init, headers });
};

const rest = new PostgrestClient(new URL("rest/v1", base).href, { headers: CLIENT_INFO, schema: "public", fetch: fetchWithAuth });
const functionsUrl = new URL("functions/v1", base).href;

export const supabase = {
  auth,
  from: rest.from.bind(rest),
  rpc: rest.rpc.bind(rest),
  schema: rest.schema.bind(rest),
  get functions() {
    return new FunctionsClient(functionsUrl, { headers: CLIENT_INFO, customFetch: fetchWithAuth });
  },
};
