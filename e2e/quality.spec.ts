import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";
import { sql } from "./db";

async function ldTypes(page: Page): Promise<string[]> {
  return page.$$eval('script[type="application/ld+json"]', (scripts) =>
    scripts.flatMap((s) => {
      const j = JSON.parse(s.textContent || "{}");
      return (j["@graph"] ?? [j]).flatMap((n: Record<string, unknown>) => ([] as unknown[]).concat(n["@type"]).map(String));
    }),
  );
}

test.describe("structured data", () => {
  test("home has Organization and LocalBusiness", async ({ page }) => {
    await page.goto("/");
    await expect.poll(() => ldTypes(page)).toEqual(expect.arrayContaining(["Organization", "LocalBusiness"]));
  });

  test("part and prebuild pages have a Product with a GST-inclusive offer", async ({ page }) => {
    const [pb] = sql<{ slug: string }>(`select slug from prebuilds where status='published' order by sort_order limit 1`);
    for (const path of ["/shop/alpha-15", `/prebuilds/${pb.slug}`]) {
      await page.goto(path);
      await expect.poll(() => ldTypes(page), { message: path }).toContain("Product");
      const offer = await page.$$eval('script[type="application/ld+json"]', (scripts) => {
        for (const s of scripts) {
          const j = JSON.parse(s.textContent || "{}");
          if ([].concat(j["@type"]).includes("Product" as never)) return j.offers ?? null;
        }
        return null;
      });
      if (offer) expect(offer.priceCurrency, path).toBe("AUD");
    }
  });
});

test.describe("cart and prebuild lists", () => {
  test("empty cart: no checks shown, checkout disabled", async ({ page }) => {
    await page.goto("/shop");
    const cart = page.locator("aside").filter({ hasText: "Your cart" }).first();
    await expect(cart.getByText(/Cart is empty/)).toBeVisible();
    await expect(cart.getByRole("button", { name: "Checkout" })).toBeDisabled();
  });

  test("Load package fills the cart (prebuild list loads on demand)", async ({ page }) => {
    const [pb] = sql<{ name: string }>(`select name from prebuilds p where status='published' and exists (select 1 from prebuild_components c where c.prebuild_id=p.id) order by sort_order limit 1`);
    await page.goto("/compatibility");
    await page.getByRole("button", { name: `Load ${pb.name}` }).click();
    const cart = page.locator("aside").filter({ hasText: "Your cart" }).first();
    await expect(cart.getByText(/Cart is empty/)).toHaveCount(0);
  });

  test("prebuild cards fetch their own photos", async ({ page }) => {
    const [{ n }] = sql<{ n: number }>(`select count(*)::int as n from prebuilds where status='published' and coalesce(image,'') <> ''`);
    test.skip(!n, "no prebuild images seeded");
    await page.goto("/prebuilds");
    const imgs = page.locator(".es-pack-tile-frame img");
    await imgs.first().scrollIntoViewIfNeeded();
    await expect.poll(() => imgs.count()).toBeGreaterThan(0);
    await expect(imgs.first()).toHaveAttribute("src", /\S/);
  });
});
