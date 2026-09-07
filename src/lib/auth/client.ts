import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const authEnabled = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const authClient = {
  signIn: {
    email: async ({
      email,
      password,
      callbackURL,
    }: {
      email: string;
      password: string;
      callbackURL?: string;
    }) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return {
        data,
        error: error ? { message: error.message } : null,
      } as const;
    },
  },
  signUp: {
    email: async ({
      email,
      password,
      name,
      callbackURL,
    }: {
      email: string;
      password: string;
      name?: string;
      callbackURL?: string;
    }) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: name } },
      });
      return {
        data,
        error: error ? { message: error.message } : null,
      } as const;
    },
  },
  signOut: async () => {
    await supabase.auth.signOut();
  },
};

export const GROK_PROVIDERS: { providerId: "google"; label: string }[] = [
  { providerId: "google", label: "Google" },
];

export async function signIn(provider: "google", options?: { callbackURL?: string }) {
  await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: options?.callbackURL
        ? `${window.location.origin}${options.callbackURL}`
        : window.location.origin,
    },
  });
}
