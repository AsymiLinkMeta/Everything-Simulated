/**
 * Pure logic for the step-by-step rig builder (/build): steps, share-link encoding,
 * filtering and sorting. No Supabase import, so it is unit-tested directly.
 */
import type { CartLine, CheckIssue, Product, ProductCategory } from "./types";

export type BuilderStepId = "chassis" | "wheelbase" | "wheel" | "pedals" | "seat" | "display" | "motion" | "pc" | "extras";

export type BuilderStep = {
  id: BuilderStepId;
  label: string;
  hint: string;
  categories: ProductCategory[];
  /** One pick replaces the last (chassis, wheelbase...). Display and extras allow several. */
  single: boolean;
};

export const BUILDER_STEPS: BuilderStep[] = [
  { id: "chassis", label: "Chassis", hint: "The frame everything bolts to. Sets the payload for motion.", categories: ["chassis"], single: true },
  { id: "wheelbase", label: "Wheelbase", hint: "Torque and quick-release. The chassis has to hold its Nm.", categories: ["wheelbase"], single: true },
  { id: "wheel", label: "Wheel", hint: "Must match the wheelbase's quick-release.", categories: ["wheel"], single: true },
  { id: "pedals", label: "Pedals", hint: "Load cell or hydraulic for consistent braking.", categories: ["pedals"], single: true },
  { id: "seat", label: "Seat", hint: "Side-mount fit and driver size.", categories: ["seat"], single: true },
  { id: "display", label: "Screens or VR", hint: "Single, triples or a headset, plus the mount.", categories: ["monitor", "mount", "headset"], single: false },
  { id: "motion", label: "Motion", hint: "Optional. Checked against chassis payload and your weight.", categories: ["motion"], single: true },
  { id: "pc", label: "PC", hint: "Optional race PC, or bring your own.", categories: ["pc"], single: true },
  { id: "extras", label: "Extras", hint: "Shifters, handbrakes, audio, adapters and software.", categories: ["shifter", "handbrake", "audio", "software", "adapter", "accessory"], single: false },
];

export function stepForCategory(cat: string): BuilderStep | undefined {
  return BUILDER_STEPS.find((s) => (s.categories as string[]).includes(cat));
}

export type BuilderBadge = "most_popular" | "flagship" | "best_value" | "new";
export const BADGE_LABELS: Record<BuilderBadge, string> = {
  most_popular: "Most popular",
  flagship: "Flagship",
  best_value: "Best value",
  new: "New",
};
export function badgeLabel(b: string | null | undefined): string | null {
  return b && b in BADGE_LABELS ? BADGE_LABELS[b as BuilderBadge] : null;
}

/* ---------- share links ---------- */

const SKU_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/i;

/** `?b=sku,sku*2,sku` — readable, short and safe to paste anywhere. */
export function encodeBuild(lines: CartLine[]): string {
  return lines
    .filter((l) => l.qty > 0 && SKU_RE.test(l.sku))
    .map((l) => (l.qty > 1 ? `${l.sku}*${Math.min(99, Math.floor(l.qty))}` : l.sku))
    .join(",");
}

/** Parses a share param. Unknown or malformed parts are dropped; repeated SKUs add up (max 99). */
export function decodeBuild(raw: string | null | undefined): CartLine[] {
  if (!raw) return [];
  const out = new Map<string, number>();
  for (const part of raw.split(",").slice(0, 40)) {
    const m = /^([^*]+)(?:\*(\d{1,2}))?$/.exec(part.trim());
    if (!m || !SKU_RE.test(m[1])) continue;
    const qty = m[2] ? Number(m[2]) : 1;
    if (qty < 1) continue;
    out.set(m[1], Math.min(99, (out.get(m[1]) ?? 0) + qty));
  }
  return [...out].map(([sku, qty]) => ({ sku, qty }));
}

/* ---------- picking ---------- */

/** Lines after choosing `item`: single-pick steps (and unique categories) replace, others toggle on. */
export function withPick(lines: CartLine[], item: Product, products: Record<string, Product>, unique: Set<string>): CartLine[] {
  const step = stepForCategory(item.category);
  const replaces = unique.has(item.category) || Boolean(step?.single);
  const kept = replaces ? lines.filter((l) => products[l.sku]?.category !== item.category) : lines.filter((l) => l.sku !== item.sku);
  return [...kept, { sku: item.sku, qty: 1 }];
}

export function withoutSku(lines: CartLine[], sku: string): CartLine[] {
  return lines.filter((l) => l.sku !== sku);
}

/** Issues a pick would add to the build: the inline "why" on a component card. */
export function newIssues(before: CheckIssue[], after: CheckIssue[]): CheckIssue[] {
  const seen = new Set(before.map((i) => `${i.code}|${i.message}`));
  return after.filter((i) => i.severity !== "allow" && !seen.has(`${i.code}|${i.message}`));
}

/* ---------- filter & sort ---------- */

export type BuilderSort = "recommended" | "price-asc" | "price-desc" | "torque";

export type BuilderFilter = {
  brand?: string;
  inStockOnly?: boolean;
  query?: string;
  category?: string;
};

const BADGE_RANK: Record<string, number> = { most_popular: 0, flagship: 1, best_value: 2, new: 3 };

export function filterAndSort<T extends Product & { badge?: string | null }>(items: T[], f: BuilderFilter, sort: BuilderSort): T[] {
  const q = (f.query ?? "").trim().toLowerCase();
  const list = items.filter(
    (p) =>
      (!f.brand || p.brand === f.brand) &&
      (!f.category || p.category === f.category) &&
      (!f.inStockOnly || p.stock === "stock") &&
      (!q || `${p.brand} ${p.name} ${p.sku}`.toLowerCase().includes(q)),
  );
  const price = (p: T) => (p.sellExGst > 0 ? p.sellExGst : Number.POSITIVE_INFINITY);
  const cmp: Record<BuilderSort, (a: T, b: T) => number> = {
    recommended: (a, b) => (BADGE_RANK[a.badge ?? ""] ?? 9) - (BADGE_RANK[b.badge ?? ""] ?? 9) || price(a) - price(b),
    "price-asc": (a, b) => price(a) - price(b),
    "price-desc": (a, b) => (b.sellExGst || 0) - (a.sellExGst || 0),
    torque: (a, b) => (b.maxNm ?? 0) - (a.maxNm ?? 0) || price(a) - price(b),
  };
  return [...list].sort((a, b) => cmp[sort](a, b) || a.name.localeCompare(b.name));
}

/* ---------- preview layers ---------- */

export type LayerRow = { category: string; sku: string | null; image_url: string; z: number; label: string | null };

/** The layer stack for the picked parts: a product's own layer wins over its category's default. */
export function layerStack(picked: Product[], layers: LayerRow[]): LayerRow[] {
  const out: LayerRow[] = [];
  for (const p of picked) {
    const own = layers.find((l) => l.sku === p.sku);
    const def = layers.find((l) => l.sku == null && l.category === p.category);
    const layer = own ?? def;
    if (layer && !out.includes(layer)) out.push(layer);
  }
  return out.sort((a, b) => a.z - b.z);
}

// ---------- rendered rig preview ----------

/** Screen layouts the preview has a photo for: none, stand only, 1, 2, 3, and 3 + the separate top screen. */
export type RigScreens = "s0" | "st" | "s1" | "s2" | "s3" | "s4";
/** Add-ons drawn as layers over the photo, back to front. */
export const RIG_OVERLAYS = ["pc", "headset", "sidemount", "shifter", "handbrake"] as const;
export type RigOverlay = (typeof RIG_OVERLAYS)[number];
/** Add-ons bolted to the frame: they ride the motion platform, so they have a raised render. */
export const RIG_RIDES: readonly RigOverlay[] = ["headset", "sidemount", "shifter", "handbrake"];

export interface RigView {
  /** Key of the full-frame studio photo, e.g. "s3m1" (screen layout + motion). */
  frame: `${RigScreens}m${0 | 1}`;
  screens: RigScreens;
  raised: boolean;
  /** Overlay files to stack on the photo, back to front (raised variants named "<part>--raised"). */
  overlays: string[];
  /** Nothing picked yet: the photo is shown dimmed as a teaser. */
  empty: boolean;
}

/**
 * Which rendered photo and overlays show a build. Every photo has the full cockpit (frame, seat,
 * wheelbase, wheel, pedals) rendered together for real contact shadows; the screen layout follows the
 * monitor quantity exactly (1 single, 2 dual, 3 triple, 4+ triple plus a distinct top screen on its own
 * posts; all curved), a stand with no monitors shows the bare stand, and a motion platform swaps in the
 * raised photo. Add-ons (PC, side mount for a shifter or handbrake, VR headset) are overlays. Staff layer
 * art for a category hides that category's overlay. An empty build shows the triple as a dimmed teaser.
 */
export function rigView(picked: Set<string>, screens: number, overridden: Set<string> = new Set()): RigView {
  const has = (c: string) => picked.has(c);
  const empty = picked.size === 0;
  const n = Math.max(0, Math.floor(screens));
  const layout: RigScreens = empty ? "s3" : n >= 4 ? "s4" : n === 3 ? "s3" : n === 2 ? "s2" : n === 1 ? "s1" : has("mount") ? "st" : "s0";
  const raised = has("motion");
  const want: Record<RigOverlay, boolean> = {
    pc: has("pc"),
    headset: has("headset"),
    sidemount: has("shifter") || has("handbrake"),
    shifter: has("shifter"),
    handbrake: has("handbrake"),
  };
  const cats: Record<RigOverlay, string[]> = { pc: ["pc"], headset: ["headset"], sidemount: ["shifter", "handbrake"], shifter: ["shifter"], handbrake: ["handbrake"] };
  const overlays = RIG_OVERLAYS.filter((o) => want[o] && !cats[o].every((c) => overridden.has(c))).map((o) =>
    raised && RIG_RIDES.includes(o) ? `${o}--raised` : o,
  );
  return { frame: `${layout}m${raised ? 1 : 0}`, screens: layout, raised, overlays, empty };
}
