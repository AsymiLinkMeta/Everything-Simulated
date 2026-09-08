import { supabase, supabaseAnonKey, supabaseUrl } from "@/lib/db";

export type DiscoveredProduct = {
  key: string;
  title: string;
  brand: string;
  url: string;
  handle?: string;
  sku?: string | null;
  image?: string | null;
  vendor?: string;
};

export async function discoverProducts(input: { query?: string; url?: string }): Promise<{
  kind: "search" | "product" | "collection";
  products: DiscoveredProduct[];
}> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error("Sign in required");

  const response = await fetch(`${supabaseUrl}/functions/v1/discover-products`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Apikey: supabaseAnonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Could not read manufacturer catalogue");
  }
  return (await response.json()) as { kind: "search" | "product" | "collection"; products: DiscoveredProduct[] };
}
