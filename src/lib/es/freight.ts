/** Australia-wide crate freight from Gold Coast, AUD cents ex GST. */
export function freightExGst(postcode?: string | null): number {
  const p = String(postcode ?? "").replace(/\D/g, "");
  if (!p) return 24500;
  if (p.startsWith("42") || p.startsWith("421") || p.startsWith("422")) return 0;
  if (p.startsWith("4")) return 18500;
  if (p.startsWith("2")) return 24500;
  if (p.startsWith("3")) return 26500;
  if (p.startsWith("5")) return 28500;
  if (p.startsWith("6")) return 32000;
  if (p.startsWith("7")) return 34000;
  if (p.startsWith("0")) return 39000;
  return 29500;
}

export function freightLabel(postcode?: string | null): string {
  const cents = freightExGst(postcode);
  if (cents === 0) return "Gold Coast collection / local drop — no crate";
  return "Australia-wide crate freight from the Gold Coast";
}
