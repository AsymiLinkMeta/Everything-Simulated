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

/**
 * Screen layouts the preview has a render for: 1 single, 2 dual, 3 triple, 3 + the separate top screen.
 * Every screen is curved, the top one included.
 */
export type RigVariant = "s1" | "s2" | "s3" | "s4";
/** Parts of the rig that light up, back to front (the order they are layered in). */
export const RIG_PARTS = ["chassis", "motion", "mount", "screens", "pc", "seat", "pedals", "wheelbase", "wheel", "sidemount", "shifter", "handbrake", "headset"] as const;
export type RigPart = (typeof RIG_PARTS)[number];

/** Which rig parts a product category lights up. Shifters and handbrakes bring their side mount. */
export const RIG_PARTS_FOR: Readonly<Record<string, readonly RigPart[]>> = {
  chassis: ["chassis"],
  wheelbase: ["wheelbase"],
  wheel: ["wheel"],
  pedals: ["pedals"],
  seat: ["seat"],
  monitor: ["screens"],
  mount: ["mount"],
  headset: ["headset"],
  motion: ["motion"],
  pc: ["pc"],
  shifter: ["sidemount", "shifter"],
  handbrake: ["sidemount", "handbrake"],
};

export function rigPartsFor(category: string | null | undefined): RigPart[] {
  return category ? [...(RIG_PARTS_FOR[category] ?? [])] : [];
}

export interface RigView {
  /** Which render of the whole rig to show: the screen layout. */
  variant: RigVariant;
  /** Parts shown photoreal, back to front. Everything else stays a ghost with an outline. */
  lit: RigPart[];
  /** Nothing picked yet: the whole rig is a ghost. */
  empty: boolean;
}

/**
 * The builder preview shows the complete rig as a see-through ghost with every part outlined, and
 * lights up the parts of the build in full studio photo quality. The screen layout follows the monitor
 * quantity exactly (1, 2, 3, 4+ = triple plus a separate top screen); with no monitors picked the triple
 * is shown, ghosted. Parts whose category has staff layer art stay ghosted (the art is drawn instead).
 */
export function rigView(picked: Set<string>, screens: number, overridden: Set<string> = new Set()): RigView {
  const n = Math.max(0, Math.floor(screens));
  const variant: RigVariant = n >= 4 ? "s4" : n === 3 ? "s3" : n === 2 ? "s2" : n === 1 ? "s1" : "s3";
  const on = new Set<RigPart>();
  for (const c of picked) if (!overridden.has(c)) for (const p of rigPartsFor(c)) on.add(p);
  return { variant, lit: RIG_PARTS.filter((p) => on.has(p)), empty: picked.size === 0 };
}
