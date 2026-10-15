import { describe, expect, it } from "vitest";
import { computeDeposit, parseDepositPercent } from "../supabase/functions/_shared/deposit.ts";

describe("computeDeposit", () => {
  it("charges 30% of the inc-GST total by default", () => {
    // Haptic: $18,999 + GST = $20,898.90
    expect(computeDeposit({ totalIncGstCents: 2089890 })).toEqual({
      depositIncGst: 626967,
      depositExGst: Math.round(626967 / 1.1),
    });
  });

  it("enforces the $500 minimum", () => {
    expect(computeDeposit({ totalIncGstCents: 100000 }).depositIncGst).toBe(50000);
  });

  it("never charges more than the order total", () => {
    // A $300 order: the $500 minimum would overcharge.
    expect(computeDeposit({ totalIncGstCents: 30000 }).depositIncGst).toBe(30000);
  });

  it("charges the whole total when full payment is requested", () => {
    expect(computeDeposit({ totalIncGstCents: 3189890, full: true }).depositIncGst).toBe(3189890);
  });

  it("honours a configured percentage", () => {
    expect(computeDeposit({ totalIncGstCents: 1000000, percent: 50 }).depositIncGst).toBe(500000);
  });

  it("treats junk totals as zero", () => {
    expect(computeDeposit({ totalIncGstCents: Number.NaN })).toEqual({ depositIncGst: 0, depositExGst: 0 });
    expect(computeDeposit({ totalIncGstCents: -500 })).toEqual({ depositIncGst: 0, depositExGst: 0 });
  });

  it("ex-GST is the inc-GST amount divided by 1.1, rounded to the cent", () => {
    const { depositIncGst, depositExGst } = computeDeposit({ totalIncGstCents: 1238600 });
    expect(depositExGst).toBe(Math.round(depositIncGst / 1.1));
  });
});

describe("parseDepositPercent", () => {
  it.each([
    [undefined, 30],
    ["", 30],
    ["abc", 30],
    ["0", 30],
    ["-5", 30],
    ["150", 30],
    ["25", 25],
    ["100", 100],
  ])("%s -> %s", (raw, expected) => {
    expect(parseDepositPercent(raw as string | undefined)).toBe(expected);
  });
});
