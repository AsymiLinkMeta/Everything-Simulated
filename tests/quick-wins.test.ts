import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ supabase: {}, supabaseUrl: "", supabaseAnonKey: "" }));

import { isProductPhoto, productPhotos } from "@/lib/es/product-photos";
import { isPlaceholderCopy, publicCopy } from "@/lib/es/placeholder-copy";
import { trustItems, validateTrustSetting } from "@/lib/es/site-settings";
import { orderForHome } from "@/lib/es/prebuilds";
import { stockLabel } from "@/lib/es/stock";
import { migrateCart } from "@/lib/es/cart-store";

describe("product photos", () => {
  it("treats stock /rigs/ art and blanks as no photo", () => {
    expect(isProductPhoto("/rigs/haptic.jpg")).toBe(false);
    expect(isProductPhoto("")).toBe(false);
    expect(isProductPhoto(null)).toBe(false);
    expect(isProductPhoto("https://x.supabase.co/storage/v1/object/public/product-images/a.webp")).toBe(true);
  });
  it("dedupes and drops stock art, keeping order", () => {
    expect(productPhotos(["/rigs/a.jpg", "https://a/1.webp", " https://a/1.webp ", null, "https://a/2.webp"])).toEqual([
      "https://a/1.webp",
      "https://a/2.webp",
    ]);
  });
});

describe("placeholder copy", () => {
  it("hides seeded placeholder text", () => {
    expect(isPlaceholderCopy("Bio is theirs to fill in.")).toBe(true);
    expect(isPlaceholderCopy("This card updates when they send their details")).toBe(true);
    expect(publicCopy("  TBC ")).toBe("");
    expect(publicCopy(null)).toBe("");
  });
  it("keeps real copy", () => {
    expect(publicCopy("  Runs a Simucube 2 Pro in GT3 trim. ")).toBe("Runs a Simucube 2 Pro in GT3 trim.");
    expect(isPlaceholderCopy("Placeholder-free bio about the todo list app he built")).toBe(false);
  });
});

describe("trust settings", () => {
  it("validates like the database", () => {
    expect(validateTrustSetting("trust_google_rating", "4.9")).toBeNull();
    expect(validateTrustSetting("trust_google_rating", "5.0")).toBeNull();
    expect(validateTrustSetting("trust_google_rating", "5.1")).toMatch(/0 to 5/);
    expect(validateTrustSetting("trust_google_review_count", "12a")).toMatch(/whole/);
    expect(validateTrustSetting("trust_google_reviews_url", "http://x")).toMatch(/https/);
    expect(validateTrustSetting("trust_warranty", "x".repeat(161))).toMatch(/160/);
    expect(validateTrustSetting("trust_warranty", "")).toBeNull();
  });
  it("shows nothing when nothing is set", () => {
    expect(trustItems({})).toEqual([]);
  });
  it("never fills gaps and skips invalid values", () => {
    const items = trustItems({ trust_google_rating: "7", trust_lead_time: "2–4 weeks" });
    expect(items).toEqual([{ key: "lead", label: "Typical lead time", value: "2–4 weeks" }]);
  });
  it("formats the Google rating with count and link", () => {
    const [g] = trustItems({ trust_google_rating: "4.9", trust_google_review_count: "1200", trust_google_reviews_url: "https://g.page/x" });
    expect(g).toEqual({ key: "google", label: "Google rating", value: "4.9 ★ from 1,200 reviews", href: "https://g.page/x" });
    expect(trustItems({ trust_google_rating: "5" })[0].value).toBe("5.0 ★");
  });
});

describe("home prebuilds", () => {
  it("puts featured first and keeps every published build", () => {
    const out = orderForHome([
      { slug: "a", featured: false },
      { slug: "b", featured: true },
      { slug: "c", featured: null },
    ]);
    expect(out.map((p) => p.slug)).toEqual(["b", "a", "c"]);
  });
  it("falls back to all builds when none are featured", () => {
    expect(orderForHome<{ slug: string; featured?: boolean }>([{ slug: "a" }, { slug: "b" }]).length).toBe(2);
  });
});

describe("stock wording", () => {
  it("never shows the trade word 'indent'", () => {
    expect(stockLabel("indent").short).toBe("Made to order");
    expect(stockLabel("indent").long).not.toMatch(/indent/i);
    expect(stockLabel("stock").short).toBe("In stock");
    expect(stockLabel(null).short).toBe("");
  });
});

describe("cart migration", () => {
  it("clears the old seeded 80 kg / 4215 defaults", () => {
    expect(migrateCart({ lines: [], driverWeightKg: 80, postcode: "4215" }, 0)).toMatchObject({ driverWeightKg: undefined, postcode: "" });
  });
  it("keeps values the customer typed", () => {
    expect(migrateCart({ driverWeightKg: 95, postcode: "2000" }, 0)).toMatchObject({ driverWeightKg: 95, postcode: "2000" });
    expect(migrateCart({ driverWeightKg: 80, postcode: "4215" }, 1)).toMatchObject({ driverWeightKg: 80, postcode: "4215" });
  });
});
