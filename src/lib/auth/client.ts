import { supabase } from "@/lib/db";

export const authEnabled = true;

export const GROK_PROVIDERS: { providerId: "google" | "twitter"; label: string }[] = [
  { providerId: "google", label: "Google" },
  { providerId: "twitter", label: "X" },
];

export const authClient = {
  signIn: {
    email: async (params: { email: string; password: string; callbackURL?: string }) => {
      const { error } = await supabase.auth.signInWithPassword({
        email: params.email,
        password: params.password,
      });
      return { error: error ? { message: error.message } : null };
    },
  },
  signUp: {
    email: async (params: { email: string; password: string; name?: string; callbackURL?: string }) => {
      const { error } = await supabase.auth.signUp({
        email: params.email,
        password: params.password,
        options: { data: { display_name: params.name } },
      });
      return { error: error ? { message: error.message } : null };
    },
  },
};

export async function signIn(providerId?: string, opts?: { callbackURL?: string }) {
  if (!providerId) return;
  const redirectTo = `${window.location.origin}${opts?.callbackURL || "/app"}`;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: providerId as "google" | "twitter",
    options: { redirectTo },
  });
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/login`,
  });
  return { error: error ? { message: error.message } : null };
}

export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  return { error: error ? { message: error.message } : null };
}
