import type { StockStatus } from "./types";

/** Customer-facing stock wording. "Indent" is trade jargon; customers see "Made to order". */
export function stockLabel(stock: StockStatus | string | null | undefined): { short: string; long: string } {
  switch (stock) {
    case "stock":
      return { short: "In stock", long: "In stock on the Gold Coast" };
    case "indent":
      return { short: "Made to order", long: "Made to order: we order it in from the maker for your build" };
    case "discontinued":
      return { short: "Discontinued", long: "Discontinued: no longer available to order" };
    default:
      return { short: "", long: "" };
  }
}
