import { supabase, supabaseAnonKey, supabaseUrl } from "@/lib/db";
import type { StaffRole } from "@/lib/es/types";

export type CreatableRole = StaffRole;

export type CreatableStaffRole = Exclude<StaffRole, "customer">;

export async function createStaffAccount(input: {
  email: string;
  password: string;
  displayName: string;
  role: CreatableRole;
  contactId?: string;
}) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error("Sign in required");

  const response = await fetch(`${supabaseUrl}/functions/v1/create-staff-account`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Apikey: supabaseAnonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const body = (await response.json()) as { error?: string; email?: string };
  if (!response.ok) throw new Error(body.error ?? "Could not create account");
  return body;
}

export async function createCustomerAccount(input: {
  email: string;
  password: string;
  displayName: string;
  contactId?: string;
}) {
  return createStaffAccount({ ...input, role: "customer" });
}
