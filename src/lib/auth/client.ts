export const authEnabled = true;
export const GROK_PROVIDERS = [
  { providerId: "google", label: "Google" },
  { providerId: "twitter", label: "X" },
];
export const authClient = {
  signIn: { email: async () => ({ error: { message: "Connect Supabase Auth in Bolt" } }) },
  signUp: { email: async () => ({ error: { message: "Connect Supabase Auth in Bolt" } }) },
};
export async function signIn() {}
export async function signOut() {}
