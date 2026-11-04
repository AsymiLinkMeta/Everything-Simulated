/**
 * Human lead-time label from a product's (or cart's) [min, max] weeks.
 * Returns null when there's nothing meaningful to say (unset or 0–0), so callers can hide the line.
 */
export function leadTimeLabel(weeks: readonly [number, number] | null | undefined, unit: "weeks" | "wks" = "weeks"): string | null {
  if (!weeks) return null;
  const min = Math.max(0, Math.round(Number(weeks[0]) || 0));
  const max = Math.max(min, Math.round(Number(weeks[1]) || 0));
  if (max <= 0) return null;
  const u = (n: number) => (unit === "wks" ? "wks" : n === 1 ? "week" : "weeks");
  if (min === max || min === 0) return min === max ? `${max} ${u(max)}` : `Up to ${max} ${u(max)}`;
  return `${min}–${max} ${u(max)}`;
}
