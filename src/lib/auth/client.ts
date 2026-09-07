import { supabase } from "@/lib/db";

export const authEnabled = true;

export const GROK_PROVIDERS: { providerId: string; label: string }[] = [];

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

export async function signIn() {}
export async function signOut() {
  await supabase.auth.signOut();
}
