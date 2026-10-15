import { useQuery } from "@tanstack/react-query";
import { aud } from "@/lib/utils";
import { fetchPublishedPrebuilds, getCachedPrebuilds, type PrebuildWithComponents } from "./prebuilds";

/**
 * Editorial copy never hardcodes a price. It uses {{price:<prebuild-slug>}},
 * which is filled here from the prebuild_prices view. If the prebuild isn't
 * published or has no price, the token reads "priced on enquiry".
 */
const TOKEN = /\{\{price:([a-z0-9-]+)\}\}/g;

export function fillPriceTokens(text: string, prebuilds: PrebuildWithComponents[] = getCachedPrebuilds()): string {
  if (!text.includes("{{")) return text;
  return text.replace(TOKEN, (_m, slug: string) => {
    const p = prebuilds.find((x) => x.slug === slug);
    if (!p) return "priced on enquiry";
    if (!p.purchasable || !p.effective_price_ex_gst) return "priced on enquiry";
    const from = p.price_ex_gst > 0 ? "" : "from ";
    return `${from}${aud(p.effective_price_ex_gst)} + GST`;
  });
}

/** Returns a filler bound to the live prebuild list, and whether prices are still loading. */
export function useLiveCopy() {
  const prebuilds = useQuery({ queryKey: ["prebuilds"], queryFn: fetchPublishedPrebuilds });
  const list = prebuilds.data ?? [];
  return {
    fill: (text: string) => (prebuilds.isPending ? text.replace(TOKEN, "…") : fillPriceTokens(text, list)),
    loading: prebuilds.isPending,
    error: prebuilds.isError,
  };
}
