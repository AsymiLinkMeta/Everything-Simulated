import { supabase, supabaseAnonKey, supabaseUrl } from "@/lib/db";

export type BillingConfig = {
  stripe: boolean;
  mail: boolean;
  depositPercent: number;
};

export type CheckoutSession = {
  url: string;
  depositIncGst: number;
};

async function fn<T>(name: string, body?: unknown, method = "POST"): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token ?? supabaseAnonKey;
  const response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Apikey: supabaseAnonKey,
      "Content-Type": "application/json",
    },
    body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
  });
  const json = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(json.error || `Request failed (${response.status})`);
  return json;
}

export async function fetchBillingConfig(): Promise<BillingConfig> {
  try {
    return await fn<BillingConfig>("billing-config", undefined, "GET");
  } catch {
    return { stripe: false, mail: false, depositPercent: 30 };
  }
}

export async function startDepositCheckout(input: {
  orderId: string;
  email: string;
  origin: string;
}): Promise<CheckoutSession> {
  return fn<CheckoutSession>("create-checkout-session", input);
}

export async function refundOrder(orderId: string, amountCents?: number) {
  return fn<{ refunded: number; status: string }>("refund-payment", { orderId, amountCents });
}

export async function notifyOrder(input: {
  orderId: string;
  kind: "placed" | "paid" | "tracking" | "refund" | "ticket";
  email?: string;
  extra?: Record<string, string>;
}) {
  try {
    await fn("send-mail", input);
  } catch {
    // Mail is best-effort — never block checkout or OMS.
  }
}
