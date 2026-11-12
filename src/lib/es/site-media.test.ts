import { describe, expect, it } from "vitest";
import { categoryLabel, categoryMedia, isMissingTable, toSiteMedia } from "./site-media";

describe("site media", () => {
  it("treats a missing table as no media", () => {
    expect(isMissingTable({ code: "42P01" })).toBe(true);
    expect(isMissingTable({ code: "PGRST205" })).toBe(true);
    expect(isMissingTable({ code: "42501" })).toBe(false);
    expect(isMissingTable(null)).toBe(false);
  });
  it("keeps only safe urls", () => {
    const m = toSiteMedia([
      { key: "category:wheel", url: " /rigs/es-cat-wheel.jpg ", alt: "Wheel" },
      { key: "category:seat", url: "javascript:alert(1)" },
      { key: "category:pc", url: "//evil.example/x.jpg" },
      { key: "fallback:product", url: "https://x.supabase.co/storage/v1/object/public/a.jpg", width: 10, height: 5 },
    ]);
    expect(Object.keys(m).sort()).toEqual(["category:wheel", "fallback:product"]);
    expect(m["category:wheel"].url).toBe("/rigs/es-cat-wheel.jpg");
    expect(m["fallback:product"].width).toBe(10);
  });
  it("picks the category render, then the fallback, then nothing", () => {
    const m = toSiteMedia([{ key: "category:wheel", url: "/a.jpg" }, { key: "fallback:product", url: "/b.jpg" }]);
    expect(categoryMedia(m, "wheel")?.url).toBe("/a.jpg");
    expect(categoryMedia(m, "pedals")?.url).toBe("/b.jpg");
    expect(categoryMedia({}, "pedals")).toBeNull();
    expect(categoryMedia(undefined, "wheel")).toBeNull();
  });
  it("labels categories", () => {
    expect(categoryLabel("monitor")).toBe("Screen");
    expect(categoryLabel("nope")).toBe("Everything Simulated");
  });
});
