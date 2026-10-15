import { describe, expect, it } from "vitest";
import { BUILDER_STEPS, rigView, RIG_OVERLAYS, badgeLabel, decodeBuild, encodeBuild, filterAndSort, layerStack, newIssues, stepForCategory, withPick } from "@/lib/es/builder-core";
import type { Product } from "@/lib/es/types";
import { RIG_PHOTO_FRAMES, RIG_PHOTO_OVERLAYS } from "@/components/es/rig-photo";

const P = (sku: string, category: string, extra: Partial<Product> = {}): Product =>
  ({ sku, brand: "B", name: sku.toUpperCase(), category, sellExGst: 1000, stock: "stock", leadWeeks: [1, 2], ...extra }) as Product;

describe("builder steps", () => {
  it("covers the brief's nine steps in order", () => {
    expect(BUILDER_STEPS.map((s) => s.id)).toEqual(["chassis", "wheelbase", "wheel", "pedals", "seat", "display", "motion", "pc", "extras"]);
  });
  it("maps every catalogue category to one step", () => {
    for (const c of ["chassis", "wheelbase", "wheel", "pedals", "seat", "monitor", "mount", "headset", "motion", "pc", "shifter", "handbrake", "audio", "software", "adapter", "accessory"])
      expect(stepForCategory(c), c).toBeTruthy();
  });
});

describe("share links", () => {
  it("round-trips a build", () => {
    const lines = [{ sku: "xr1", qty: 1 }, { sku: "aoc-32", qty: 3 }];
    expect(encodeBuild(lines)).toBe("xr1,aoc-32*3");
    expect(decodeBuild("xr1,aoc-32*3")).toEqual(lines);
  });
  it("drops junk and caps quantities", () => {
    expect(decodeBuild("<script>,ok,ok,x*0,y*99,y*5,../etc")).toEqual([{ sku: "ok", qty: 2 }, { sku: "y", qty: 99 }]);
    expect(decodeBuild("")).toEqual([]);
    expect(decodeBuild(null)).toEqual([]);
  });
});

describe("picking", () => {
  const map = { a: P("a", "chassis"), b: P("b", "chassis"), m1: P("m1", "monitor"), m2: P("m2", "monitor") };
  const unique = new Set(["chassis"]);
  it("single-pick steps swap the part", () => {
    expect(withPick([{ sku: "a", qty: 1 }], map.b, map, unique)).toEqual([{ sku: "b", qty: 1 }]);
  });
  it("multi-pick steps add alongside", () => {
    expect(withPick([{ sku: "m1", qty: 1 }], map.m2, map, unique)).toEqual([{ sku: "m1", qty: 1 }, { sku: "m2", qty: 1 }]);
  });
  it("reports only the issues a pick introduces", () => {
    const before = [{ code: "X", severity: "warn" as const, message: "old" }];
    const after = [...before, { code: "Y", severity: "block" as const, message: "new" }, { code: "Z", severity: "allow" as const, message: "fine" }];
    expect(newIssues(before, after).map((i) => i.code)).toEqual(["Y"]);
  });
});

describe("filter and sort", () => {
  const items = [
    { ...P("cheap", "wheelbase", { sellExGst: 500, brand: "A", maxNm: 8 }), badge: null },
    { ...P("pop", "wheelbase", { sellExGst: 900, brand: "B", maxNm: 15, stock: "indent" }), badge: "most_popular" },
    { ...P("flag", "wheelbase", { sellExGst: 2000, brand: "B", maxNm: 25 }), badge: "flagship" },
  ];
  it("recommended puts DB badges first", () => {
    expect(filterAndSort(items, {}, "recommended").map((p) => p.sku)).toEqual(["pop", "flag", "cheap"]);
  });
  it("sorts by price and torque", () => {
    expect(filterAndSort(items, {}, "price-desc").map((p) => p.sku)).toEqual(["flag", "pop", "cheap"]);
    expect(filterAndSort(items, {}, "torque")[0].sku).toBe("flag");
  });
  it("filters by brand and stock", () => {
    expect(filterAndSort(items, { brand: "B", inStockOnly: true }, "price-asc").map((p) => p.sku)).toEqual(["flag"]);
  });
  it("labels only known badges", () => {
    expect(badgeLabel("flagship")).toBe("Flagship");
    expect(badgeLabel("made_up")).toBeNull();
  });
});

describe("preview layers", () => {
  it("a product's own layer beats the category default, ordered by z", () => {
    const layers = [
      { category: "seat", sku: null, image_url: "/l/seat.webp", z: 2, label: null },
      { category: "chassis", sku: null, image_url: "/l/chassis.webp", z: 0, label: null },
      { category: "chassis", sku: "xr1", image_url: "/l/xr1.webp", z: 1, label: null },
    ];
    const out = layerStack([P("seat-1", "seat"), P("xr1", "chassis")], layers);
    expect(out.map((l) => l.image_url)).toEqual(["/l/xr1.webp", "/l/seat.webp"]);
    expect(layerStack([P("pc", "pc")], layers)).toEqual([]);
  });
});

describe("rendered rig preview", () => {
  const cats = (...c: string[]) => new Set(c);
  it("has a photo (AVIF + WebP) for every screen layout with and without motion, and every overlay", () => {
    for (const s of ["s0", "st", "s1", "s2", "s3", "s4"])
      for (const m of [0, 1]) {
        expect(RIG_PHOTO_FRAMES[`${s}m${m}`]?.avif, `${s}m${m}`).toMatch(/\.avif$/);
        expect(RIG_PHOTO_FRAMES[`${s}m${m}`]?.webp, `${s}m${m}`).toMatch(/\.webp$/);
      }
    for (const o of RIG_OVERLAYS) {
      expect(RIG_PHOTO_OVERLAYS[o], o).toBeDefined();
      if (o !== "pc") expect(RIG_PHOTO_OVERLAYS[`${o}--raised`], `${o}--raised`).toBeDefined();
    }
  });
  it("every reachable build maps to a photo that exists", () => {
    const all = ["chassis", "seat", "wheelbase", "wheel", "pedals", "monitor", "mount", "headset", "motion", "pc", "shifter", "handbrake"];
    for (let mask = 0; mask < 1 << all.length; mask += 7) {
      const picked = new Set(all.filter((_, i) => mask & (1 << i)));
      for (const n of [0, 1, 2, 3, 4, 6]) {
        const v = rigView(picked, n);
        expect(RIG_PHOTO_FRAMES[v.frame], v.frame).toBeDefined();
        for (const o of v.overlays) expect(RIG_PHOTO_OVERLAYS[o], o).toBeDefined();
      }
    }
  });
  it("empty build: the triple photo as a dimmed teaser, no add-ons", () => {
    expect(rigView(cats(), 0)).toMatchObject({ frame: "s3m0", empty: true, overlays: [] });
  });
  it("screen count picks the layout exactly: 1 single, 2 dual, 3 triple, 4+ triple and the separate top screen", () => {
    const m = cats("chassis", "monitor", "mount");
    expect([1, 2, 3, 4, 5].map((n) => rigView(m, n).screens)).toEqual(["s1", "s2", "s3", "s4", "s4"]);
    expect(rigView(cats("chassis"), 0).screens).toBe("s0");
    expect(rigView(cats("chassis", "mount"), 0).screens).toBe("st");
  });
  it("a motion platform swaps in the raised photo and raised add-ons", () => {
    const v = rigView(cats("chassis", "motion", "shifter", "pc"), 3);
    expect(v.frame).toBe("s3m1");
    expect(v.raised).toBe(true);
    expect(v.overlays).toEqual(["pc", "sidemount--raised", "shifter--raised"]);
  });
  it("a VR build with no screens or stand shows the bare cockpit and the headset", () => {
    expect(rigView(cats("chassis", "headset"), 0)).toMatchObject({ frame: "s0m0", overlays: ["headset"] });
  });
  it("either shifter or handbrake brings in the side mount; overlays stack back to front", () => {
    expect(rigView(cats("handbrake"), 0).overlays).toEqual(["sidemount", "handbrake"]);
    expect(rigView(cats("handbrake", "shifter", "headset", "pc"), 0).overlays).toEqual(["pc", "headset", "sidemount", "shifter", "handbrake"]);
  });
  it("staff layer art for a category hides that category's overlay only", () => {
    const v = rigView(cats("pc", "shifter"), 0, cats("pc"));
    expect(v.overlays).toEqual(["sidemount", "shifter"]);
  });
});
