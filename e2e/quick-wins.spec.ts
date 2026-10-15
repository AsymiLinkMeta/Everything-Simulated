import { test, expect, authFile } from "./fixtures";
import { exec, sql } from "./db";

/** PR A ("quick wins") behaviour: honest photos, trust bar from the DB, one clear CTA, mobile buy bar, contact actions. */

test.describe("product photos", () => {
  test("a part with no real photo shows the 'Photo coming' tile, not stock rig art", async ({ page }) => {
    const [row] = sql<{ image: string | null }>(`select image from catalog_products where sku = 'aoc-32'`);
    expect(row.image ?? "").toMatch(/^\/rigs\/|^$/);
    await page.goto("/shop/aoc-32");
    await expect(page.getByTestId("photo-coming").first()).toBeVisible();
    await expect(page.locator('main img[src^="/rigs/"]')).toHaveCount(0);
  });

  test("shop tiles never fall back to stock rig shots", async ({ page }) => {
    await page.goto("/shop");
    await expect(page.getByTestId("photo-coming").first()).toBeVisible();
    await expect(page.locator('a[href^="/shop/"] img[src^="/rigs/"]')).toHaveCount(0);
  });
});

test.describe("stock wording", () => {
  test("customers never see 'Indent'", async ({ page }) => {
    await page.goto("/shop");
    await expect(page.getByTestId("photo-coming").first()).toBeVisible();
    await expect(page.locator("main")).not.toContainText(/\bindent\b/i);
  });
});

test.describe("trust bar", () => {
  test.describe.configure({ mode: "serial" });
  test.afterAll(() => exec(`delete from site_settings`));

  test("hidden when nothing is set, shown with exactly the stored facts", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "mutates shared settings");
    exec(`delete from site_settings`);
    await page.goto("/prebuilds");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByTestId("trust-bar")).toHaveCount(0);

    exec(`insert into site_settings (key, value) values ('trust_lead_time', '3–5 weeks'), ('trust_google_rating', '4.8')`);
    await page.reload();
    const bar = page.getByTestId("trust-bar");
    await expect(bar).toBeVisible();
    await expect(bar).toContainText("3–5 weeks");
    await expect(bar).toContainText("4.8 ★");
    // Nothing that wasn't entered.
    await expect(bar).not.toContainText(/warranty/i);
    await expect(bar).not.toContainText(/reviews/i);
    await expect(bar.getByRole("link")).toHaveCount(0);
  });

  // Same shared table, so it runs in this serial block.
  test.describe("staff site settings", () => {
    test.use({ storageState: authFile("admin") });

    test("admin edits the trust bar; invalid ratings are refused", async ({ page }, info) => {
      test.skip(info.project.name !== "desktop", "mutates shared settings");
      exec(`delete from site_settings`);
      await page.goto("/staff/site");
      await expect(page.getByRole("heading", { name: "Site settings" })).toBeVisible();
      await expect(page.getByText("Nothing set, so the bar is hidden.")).toBeVisible();
      const rating = page.locator('input[name="trust_google_rating"]');
      await rating.fill("6");
      await expect(page.getByText("Rating is a number from 0 to 5")).toBeVisible();
      await expect(page.getByRole("button", { name: "Save settings" })).toBeDisabled();
      await rating.fill("4.9");
      await page.locator('input[name="trust_warranty"]').fill("12-month workshop warranty");
      await page.getByRole("button", { name: "Save settings" }).click();
      await expect.poll(() => sql<{ n: number }>(`select count(*)::int n from site_settings`)[0].n).toBe(2);
      await page.goto("/");
      await expect(page.getByTestId("trust-bar")).toContainText("12-month workshop warranty");
    });
  });
});

test.describe("staff product photo upload", () => {
  test.use({ storageState: authFile("admin") });

  test("a photo dropped in the catalogue editor lands in the product-images bucket", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "one upload is enough");
    // Storage rows can only be removed through the Storage API, so match on this run's upload time.
    const [{ since }] = sql<{ since: string }>(`select now()::text since`);
    await page.goto("/staff/catalog");
    const row = page.locator("tr", { hasText: "alpha-15" }).first();
    await row.getByRole("button", { name: "Edit" }).click();
    await page.locator('input[type="file"]').first().setInputFiles("public/rigs/Everything_Simulated_Hero-640.webp");
    await expect(page.getByText("Photo added")).toBeVisible({ timeout: 20_000 });
    const [obj] = sql<{ name: string; mime: string }>(
      `select name, metadata->>'mimetype' mime from storage.objects where bucket_id = 'product-images' and name like 'alpha-15/%' and created_at >= '${since}' order by created_at desc limit 1`,
    );
    expect(obj?.name).toMatch(/^alpha-15\/[0-9a-f-]+\.(webp|jpg)$/);
    expect(obj.mime).toMatch(/image\/(webp|jpeg)/);
    const src = await page.locator(`img[src*="/storage/v1/object/public/product-images/${obj.name}"]`).first().getAttribute("src");
    expect(src).toBeTruthy();
    const res = await page.request.get(src!);
    expect(res.status()).toBe(200);
  });
});

test.describe("calls to action", () => {
  test("prebuild page has one primary action", async ({ page }, info) => {
    await page.goto("/prebuilds/haptic");
    await expect(page.getByTestId("prebuild-add")).toBeVisible();
    await expect(page.getByRole("link", { name: "Buy this build" })).toBeVisible();
    // Primary buttons are the red gradient .es-btn without a quieter variant class (sticky bar is mobile-only, hidden on desktop).
    const primaries = page.locator("main .es-btn:not(.es-btn-ghost):not(.es-btn-text):not(.es-btn-subtle):visible");
    const n = await primaries.count();
    expect(n, `primary buttons on ${info.project.name}`).toBeLessThanOrEqual(info.project.name === "mobile" ? 2 : 1);
    await page.getByTestId("prebuild-add").click();
    await expect(page.getByTestId("prebuild-add")).toHaveText(/In your cart/);
  });

  test("ambassador profile hides seeded placeholder copy", async ({ page }) => {
    await page.goto("/ambassadors/carter-cosgrove-racing");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("main")).not.toContainText(/theirs to fill|updates when they send|lands when they send/i);
    await expect(page.getByRole("link", { name: "Checkout this crate" })).toHaveCount(0);
  });
});

test.describe("home", () => {
  test("lists every published prebuild, featured first", async ({ page }) => {
    const rows = sql<{ name: string; featured: boolean }>(`select name, featured from prebuilds where status = 'published' order by featured desc`);
    await page.goto("/");
    for (const r of rows) await expect(page.getByRole("link", { name: r.name, exact: true }).first()).toBeAttached();
  });
});

test.describe("mobile buy bar", () => {
  test("sticky price, add and cart on a product page", async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "mobile only");
    await page.goto("/shop/alpha-15");
    const bar = page.getByRole("region", { name: "Buy" });
    await expect(bar).toBeVisible();
    await expect(bar).toContainText("$");
    await page.mouse.wheel(0, 2000);
    await expect(bar).toBeInViewport();
    await bar.getByRole("button").click();
    await expect(bar.getByRole("link", { name: /Cart, 1 item/ })).toBeVisible();
    // The return-to-top button sits above the bar, not on it.
    const top = page.getByRole("button", { name: "Return to top" });
    await expect(top).toBeVisible();
    const [a, b] = [await top.boundingBox(), await bar.boundingBox()];
    expect(a!.y + a!.height).toBeLessThanOrEqual(b!.y + 1);
  });

  test("shop grid stays inside the screen with a part in the cart", async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "mobile only");
    await page.goto("/shop/alpha-15");
    await page.getByRole("region", { name: "Buy" }).getByRole("button").click();
    for (const path of ["/shop", "/compatibility"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      // Anything sticking out past the screen edge that isn't inside a clipping/scrolling box.
      const overflow = await page.evaluate(() => {
        const clipped = (el: Element) => {
          for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) if (getComputedStyle(a).overflowX !== "visible") return true;
          return false;
        };
        return [...document.querySelectorAll("main *")]
          .filter((el) => el.getBoundingClientRect().right > innerWidth + 1 && !clipped(el))
          .map((el) => `${el.tagName}.${String(el.className).slice(0, 60)}`)
          .slice(0, 3);
      });
      expect(overflow, `${path} overflows sideways`).toEqual([]);
    }
  });

  test("hidden on desktop", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "desktop only");
    await page.goto("/shop/alpha-15");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("region", { name: "Buy" })).toBeHidden();
  });
});

test.describe("forms", () => {
  test("build panel starts with empty postcode and weight (hints, not values)", async ({ page }) => {
    await page.goto("/shop/alpha-15");
    await page.getByRole("button", { name: /Add to cart/ }).first().click();
    await page.goto("/compatibility");
    const postcode = page.getByPlaceholder("e.g. 4215").first();
    await expect(postcode).toHaveValue("");
    await expect(page.getByPlaceholder("e.g. 80").first()).toHaveValue("");
    await expect(page.getByText(/Add your postcode for the exact price/).first()).toBeVisible();
  });

  test("text areas use the dark surface, not white", async ({ page }) => {
    await page.goto("/contact");
    const bg = await page.locator("textarea").first().evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).not.toBe("rgb(255, 255, 255)");
  });
});

test.describe("contact", () => {
  test("tap to call and email", async ({ page }) => {
    await page.goto("/contact");
    await expect(page.getByTestId("contact-call")).toHaveAttribute("href", /^tel:0\d{9}$/);
    await expect(page.getByTestId("contact-email")).toHaveAttribute("href", "mailto:hello@everythingsimulated.com.au");
    await expect(page.getByText("Staff inbox")).toHaveCount(0);
  });
});

test.describe("staff login", () => {
  test("not in the customer footer; discreet link on the sign-in page", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator("footer");
    await expect(footer).toBeAttached();
    await expect(footer).not.toContainText(/staff/i);
    await page.goto("/login");
    await page.getByRole("link", { name: "Staff login" }).click();
    await expect(page).toHaveURL(/portal=staff/);
  });
});

test.describe("not found", () => {
  test("unknown pages show the not-found screen and are noindex", async ({ page }) => {
    await page.goto("/this-page-does-not-exist");
    await expect(page.getByRole("heading", { name: /isn’t in the workshop/ })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });
});
