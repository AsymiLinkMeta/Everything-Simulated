import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/db";
import type { CartLine, CheckIssue } from "./types";

/** What quote_cart() returns. Every figure is AUD cents and comes from the database. */
export type ServerQuote = {
  ok: boolean;
  mode: "package" | "parts";
  prebuild: string | null;
  package_ex_gst: number | null;
  lines: {
    sku: string;
    qty: number;
    name: string;
    category: string;
    unit_ex_gst: number;
    line_ex_gst: number;
    included: boolean;
  }[];
  items_ex_gst: number;
  freight: {
    cents: number;
    zone: string;
    label: string;
    kg: number;
    crates: number;
    breakdown: { label: string; cents: number }[];
  };
  freight_ex_gst: number;
  total_ex_gst: number;
  gst_cents: number;
  total_inc_gst: number;
  lead_weeks: [number, number];
  issues: (CheckIssue & { sku?: string })[];
};

export type QuoteInput = {
  lines: CartLine[];
  postcode?: string;
  prebuild?: string | null;
  driverWeightKg?: number;
};

export async function quoteCart(input: QuoteInput): Promise<ServerQuote> {
  const { data, error } = await supabase.rpc("quote_cart", {
    p_lines: input.lines.filter((l) => l.sku && l.qty > 0).map((l) => ({ sku: l.sku, qty: l.qty })),
    p_postcode: input.postcode || null,
    p_prebuild: input.prebuild || null,
    p_driver_kg: input.driverWeightKg ? Math.round(input.driverWeightKg) : null,
  });
  if (error) throw new Error(error.message);
  return data as ServerQuote;
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

type QuoteKey = { l: [string, number][]; p: string; b: string | null; w: number | null };

/** The price the customer will actually be charged, refreshed as the cart changes. */
export function useServerQuote(input: QuoteInput, opts?: { enabled?: boolean }) {
  const key = JSON.stringify({
    l: input.lines.filter((l) => l.qty > 0).map((l) => [l.sku, l.qty]),
    p: (input.postcode ?? "").replace(/\D/g, "").slice(0, 4),
    b: input.prebuild ?? null,
    w: input.driverWeightKg ?? null,
  } satisfies QuoteKey);
  const debounced = useDebounced(key, 250);
  const query = useQuery({
    queryKey: ["quote_cart", debounced],
    queryFn: () => {
      const k = JSON.parse(debounced) as QuoteKey;
      return quoteCart({
        lines: k.l.map(([sku, qty]) => ({ sku, qty })),
        postcode: k.p,
        prebuild: k.b,
        driverWeightKg: k.w ?? undefined,
      });
    },
    enabled: (opts?.enabled ?? true) && input.lines.length > 0,
    placeholderData: (prev) => prev,
    staleTime: 30_000,
    retry: 1,
  });
  // True while the cart has changed but its new price hasn't been fetched yet (debounce or request in flight),
  // so callers never let the customer pay a figure that's about to change.
  return Object.assign(query, { isSettling: key !== debounced || query.isFetching || query.isPlaceholderData });
}

/** Turn a Postgres error from place_order / staff RPCs into a sentence for a toast. */
export function rpcMessage(err: unknown): string {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === "object" && err && "message" in err
        ? String((err as { message: unknown }).message)
        : String(err ?? "");
  return msg.replace(/^.*?ERROR:\s*/i, "").trim() || "Something went wrong. Please try again.";
}
