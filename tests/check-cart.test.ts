import { describe, expect, it, vi } from "vitest";

// The checker is pure; keep the Supabase client (and its network/WebSocket setup) out of it.
vi.mock("@/lib/db", () => ({ supabase: {}, supabaseUrl: "", supabaseAnonKey: "" }));

import { checkCart } from "@/lib/es/checkCart";
import { RULES } from "@/lib/es/catalog";
import { PRODUCTS } from "./fixtures";

const GOLD_COAST = "4217"; // local zone: no freight unless motion is in the build

function run(lines: { sku: string; qty: number }[], extra: { driverWeightKg?: number; postcode?: string } = {}) {
  return checkCart({ lines, products: PRODUCTS, rules: RULES, postcode: GOLD_COAST, ...extra });
}
const codes = (r: ReturnType<typeof run>) => r.issues.map((i) => i.code);

describe("checkCart: hard compatibility facts", () => {
  it("passes a clean XR1 + Alpha 15 build", () => {
    const r = run([
      { sku: "xr1", qty: 1 },
      { sku: "alpha-15", qty: 1 },
      { sku: "gt-neo", qty: 1 },
      { sku: "p1000", qty: 1 },
    ]);
    expect(r.ok).toBe(true);
    expect(r.issues).toEqual([]);
  });

  it("blocks SIMRIG SR2 on the TR120S", () => {
    const r = run([
      { sku: "tr120s", qty: 1 },
      { sku: "sr2", qty: 1 },
    ]);
    expect(r.ok).toBe(false);
    expect(codes(r)).toContain("SR2-TR120");
    expect(r.issues.find((i) => i.code === "SR2-TR120")?.severity).toBe("block");
  });

  it("allows SR2 on the Exodus XR1 within payload", () => {
    const r = run([
      { sku: "xr1", qty: 1 },
      { sku: "sr2", qty: 1 },
    ], { driverWeightKg: 80 });
    expect(r.ok).toBe(true);
    expect(codes(r)).not.toContain("SR2-TR120");
  });

  it("blocks the four-screen frame on the TR120S", () => {
    const r = run([
      { sku: "tr120s", qty: 1 },
      { sku: "quad-mount", qty: 1 },
    ]);
    expect(r.ok).toBe(false);
    expect(codes(r)).toContain("QUAD-TR120");
  });

  it("requires the Simagic side-mount kit for Alpha EVO on TR120S, and clears it once added", () => {
    const without = run([
      { sku: "tr120s", qty: 1 },
      { sku: "alpha-evo-12", qty: 1 },
    ]);
    expect(without.ok).toBe(true); // adapter is not a block
    expect(codes(without)).toEqual(expect.arrayContaining(["ALPHA-TR120", "MISSING_side-mount"]));

    const withKit = run([
      { sku: "tr120s", qty: 1 },
      { sku: "alpha-evo-12", qty: 1 },
      { sku: "side-mount", qty: 1 },
    ]);
    expect(codes(withKit)).toContain("ALPHA-TR120");
    expect(codes(withKit)).not.toContain("MISSING_side-mount");
  });

  it("warns (does not block) on hydraulic P1000 on TR120S", () => {
    const r = run([
      { sku: "tr120s", qty: 1 },
      { sku: "p1000-haptic", qty: 1 },
    ]);
    expect(r.ok).toBe(true);
    expect(r.issues.find((i) => i.code === "HYD-TR120")?.severity).toBe("warn");
  });

  it("applies rules regardless of which side of the pair is listed first", () => {
    const r = run([
      { sku: "sr2", qty: 1 },
      { sku: "tr120s", qty: 1 },
    ]);
    expect(codes(r)).toContain("SR2-TR120");
  });
});

describe("checkCart: one-per-build categories", () => {
  it("blocks two different wheelbases", () => {
    const r = run([
      { sku: "xr1", qty: 1 },
      { sku: "alpha-15", qty: 1 },
      { sku: "alpha-evo-12", qty: 1 },
    ]);
    expect(r.ok).toBe(false);
    expect(codes(r)).toContain("MULTI_WHEELBASE");
  });

  it("blocks two chassis", () => {
    const r = run([
      { sku: "xr1", qty: 1 },
      { sku: "tr120s", qty: 1 },
    ]);
    expect(codes(r)).toContain("MULTI_CHASSIS");
  });

  it("allows multiple monitors (not a unique category)", () => {
    const r = run([
      { sku: "xr1", qty: 1 },
      { sku: "aoc-32", qty: 3 },
    ]);
    expect(codes(r)).not.toContain("MULTI_MONITOR");
    expect(r.ok).toBe(true);
  });
});

describe("checkCart: physical limits", () => {
  it("blocks when the motion payload is exceeded", () => {
    const r = run([
      { sku: "xr1", qty: 1 },
      { sku: "sr2", qty: 1 },
      { sku: "touring-seat", qty: 1 },
      { sku: "aoc-32", qty: 4 },
    ], { driverWeightKg: 130 });
    // 130 + 45 + 48 + 14 + 28 = 265 kg > 225 kg
    expect(r.ok).toBe(false);
    expect(codes(r)).toContain("MOTION_PAYLOAD");
  });

  it("warns when the wheelbase torque exceeds the chassis ceiling", () => {
    const r = run([
      { sku: "tr120s", qty: 1 },
      { sku: "big-base", qty: 1 },
    ]);
    expect(r.issues.find((i) => i.code === "TORQUE_CHASSIS")?.severity).toBe("warn");
  });

  it("blocks unknown SKUs instead of silently dropping them", () => {
    const r = run([{ sku: "not-a-real-part", qty: 1 }]);
    expect(r.ok).toBe(false);
    expect(codes(r)).toContain("UNKNOWN_SKU");
  });

  it("ignores zero-quantity lines", () => {
    const r = run([
      { sku: "xr1", qty: 1 },
      { sku: "tr120s", qty: 0 },
    ]);
    expect(codes(r)).not.toContain("MULTI_CHASSIS");
  });
});

describe("checkCart: totals", () => {
  it("sums ex-GST, adds 10% GST and takes the longest lead time", () => {
    const r = run([
      { sku: "xr1", qty: 1 }, // 3000.00
      { sku: "aoc-32", qty: 3 }, // 3 x 700.00
      { sku: "side-mount", qty: 1 }, // 150.00, lead 1-2
    ]);
    expect(r.totalExGst).toBe(300000 + 210000 + 15000);
    expect(r.freightExGst).toBe(0); // Gold Coast, no motion
    expect(r.totalIncGst).toBe(Math.round(525000 * 1.1));
    expect(r.leadWeeks).toEqual([3, 6]);
  });

  it("includes freight in the GST-inclusive total outside the local zone", () => {
    const r = run([{ sku: "xr1", qty: 1 }], { postcode: "3000" });
    expect(r.freightExGst).toBeGreaterThan(0);
    expect(r.totalIncGst).toBe(Math.round((r.totalExGst + r.freightExGst) * 1.1));
  });
});
