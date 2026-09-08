import { supabase, supabaseAnonKey, supabaseUrl } from "@/lib/db";

export type ProductListing = {
  sku: string;
  brand: string;
  name: string;
  category: string;
  price: number;
  stockStatus: "stock" | "indent" | "discontinued";
  leadWeeksMin: number;
  leadWeeksMax: number;
  description: string;
  notes: string;
  imageUrl?: string;
  images?: string[];
  manufacturerUrl?: string;
  whatsIncluded?: string[];
  mountCompatibility?: string;
  assemblyManualUrl?: string;
  specs?: Record<string, string>;
  compare?: string;
};

export async function generateProductListing(input: {
  brand: string;
  productName: string;
  category: string;
  price: string;
  details: string;
  url?: string;
}) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error("Sign in required");

  const response = await fetch(`${supabaseUrl}/functions/v1/generate-product-listing`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Apikey: supabaseAnonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error("Could not generate a listing");
  const body = (await response.json()) as { listing?: ProductListing; source?: "grok" | "draft" };
  if (!body.listing) throw new Error("Could not generate a listing");
  return body;
}
