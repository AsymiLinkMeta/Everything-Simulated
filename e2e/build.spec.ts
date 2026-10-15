import { test, expect, authFile } from "./fixtures";
import { exec, sql } from "./db";

/** The step-by-step rig builder at /build. Every part, price, badge and layer comes from the local DB. */

const steps = (page: import("@playwright/test").Page) => page.getByRole("navigation", { name: "Build steps" });
const total = (page: import("@playwright/test").Page) => page.getByTestId("builder-total");

test.describe("rig builder", () => {
  test("nine numbered steps; Next moves on and focuses the step heading", async ({ page }) => {
    await page.goto("/build");
    const nav = steps(page);
    await expect(nav.getByRole("button")).toHaveCount(9);
    await expect(nav.getByRole("button", { name: /Chassis/ })).toHaveAttribute("aria-current", "step");
    await page.getByRole("button", { name: /Skip: Wheelbase|Next: Wheelbase/ }).click();
    await expect(nav.getByRole("button", { name: /Wheelbase/ })).toHaveAttribute("aria-current", "step");
    await expect(page.getByRole("heading", { level: 2, name: "Wheelbase" })).toBeFocused();
    await expect(page).toHaveURL(/step=wheelbase/);
  });

  test("picking a chassis updates the running total from quote_cart", async ({ page }) => {
    await page.goto("/build?step=chassis");
    await expect(total(page)).toContainText("0 parts");
    await page.getByTestId("builder-card-tr120s").getByRole("button", { name: "Choose" }).click();
    await expect(page.getByTestId("builder-card-tr120s")).toContainText("In your build");
    await expect(total(page)).toContainText("1 part");
    await expect(total(page)).toContainText(/\$\d/);
    await expect(steps(page).getByRole("button", { name: /Chassis/ })).toContainText(/TR120S/i);
  });

  test("conflicts are explained on the card and blocked parts can't be chosen", async ({ page }) => {
    const [rule] = sql<{ reason: string }>(`select reason from compatibility_rules where left_sku = 'sr2' and right_sku = 'tr120s' and severity = 'block'`);
    test.skip(!rule, "no SR2/TR120S block rule seeded");
    await page.goto("/build?step=chassis");
    await page.getByTestId("builder-card-tr120s").getByRole("button", { name: "Choose" }).click();
    await steps(page).getByRole("button", { name: /Motion/ }).click();
    const card = page.getByTestId("builder-card-sr2");
    await expect(card.getByTestId("builder-conflict")).toContainText(rule.reason);
    await expect(card.getByTestId("builder-conflict")).toContainText("Won't work");
    await expect(card.getByRole("button", { name: "Doesn't fit this build" })).toBeDisabled();
  });

  test("swapping a single-pick part replaces it", async ({ page }) => {
    await page.goto("/build?step=chassis");
    await page.getByTestId("builder-card-tr120s").getByRole("button", { name: "Choose" }).click();
    await page.getByTestId("builder-card-xr1").getByRole("button", { name: "Swap to this" }).click();
    await expect(page.getByTestId("builder-card-xr1")).toContainText("In your build");
    await expect(page.getByTestId("builder-card-tr120s")).not.toContainText("In your build");
    await expect(total(page)).toContainText("1 part");
  });

  test("start from a prebuild", async ({ page }) => {
    const [pb] = sql<{ name: string; n: number }>(
      `select p.name, count(c.*)::int n from prebuilds p join prebuild_components c on c.prebuild_id = p.id where p.status = 'published' group by p.id, p.name, p.sort_order order by p.sort_order limit 1`,
    );
    await page.goto("/build");
    await page.getByRole("button", { name: pb.name, exact: true }).click();
    await expect(page.getByRole("button", { name: pb.name, exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(total(page)).toContainText(/\d+ parts/);
    await expect(total(page)).toContainText("prebuild price");
  });

  test("a share link loads the build, and Share copies one", async ({ page, context }, info) => {
    await page.goto("/build?b=xr1,alpha-15,not-a-real-sku");
    await expect(total(page)).toContainText("2 parts");
    await expect(page).not.toHaveURL(/b=/);
    test.skip(info.project.name !== "desktop", "clipboard permission is desktop Chromium only");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await total(page).getByRole("button", { name: "Copy share link" }).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toMatch(/\/build\?b=xr1,alpha-15$/);
  });

  test("checkout goes through with a compatible build", async ({ page }) => {
    await page.goto("/build?b=xr1,alpha-15,gt-neo");
    await expect(total(page)).toContainText("3 parts");
    await total(page).getByRole("link", { name: "Checkout" }).click();
    await expect(page).toHaveURL(/\/checkout/);
    await expect(page.getByText("Simagic Alpha 15Nm Wheelbase").first()).toBeVisible();
  });

  test("every control has an accessible name and tap targets are at least 44px", async ({ page }, info) => {
    await page.goto("/build?step=wheelbase");
    await expect(page.getByTestId("builder-card-alpha-15")).toBeVisible();
    const bad = await page.evaluate(() =>
      [...document.querySelectorAll("main button, main select, main a, [data-testid=builder-total] button, [data-testid=builder-total] a")]
        .filter((el) => (el as HTMLElement).offsetParent !== null)
        .filter((el) => {
          const r = el.getBoundingClientRect();
          const name = (el.getAttribute("aria-label") || el.textContent || "").trim() || (el.closest("label")?.textContent ?? "").trim();
          return !name || (el.closest(".es-rb, [data-testid=builder-total]") && Math.min(r.height, r.width) < 43);
        })
        .map((el) => el.outerHTML.slice(0, 80)),
    );
    expect(bad, info.project.name).toEqual([]);
  });
});

test.describe("rig builder data from staff", () => {
  test.describe.configure({ mode: "serial" });
  test.afterAll(() => {
    exec(`update catalog_products set builder_badge = null where builder_badge is not null`);
    exec(`delete from builder_layers`);
  });

  test("badges come from catalog_products.builder_badge", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "mutates shared catalogue rows");
    exec(`update catalog_products set builder_badge = null where builder_badge is not null`);
    await page.goto("/build?step=wheelbase");
    await expect(page.getByTestId("builder-card-alpha-15")).toBeVisible();
    await expect(page.getByTestId("builder-badge")).toHaveCount(0);
    exec(`update catalog_products set builder_badge = 'most_popular' where sku = 'alpha-15'`);
    await page.reload();
    await expect(page.getByTestId("builder-card-alpha-15").getByTestId("builder-badge")).toHaveText("Most popular");
    // Recommended sort puts badged parts first.
    await expect(page.locator("[data-testid^=builder-card-]").first()).toHaveAttribute("data-testid", "builder-card-alpha-15");
  });

  test("preview: rendered layers until staff add layer art", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "mutates shared layer rows");
    exec(`delete from builder_layers`);
    await page.goto("/build?b=xr1");
    await expect(page.getByTestId("rig-preview")).toHaveAttribute("data-mode", "rendered");
    const preview = page.getByTestId("rig-preview");
    await expect(preview.locator('[data-part="chassis"]').first()).toHaveAttribute("data-state", "on");
    await expect(preview.locator('[data-part="seat"]').first()).toHaveAttribute("data-state", "ghost");
    exec(`insert into builder_layers (category, image_url, z, label) values ('chassis', '/rigs/haptic.jpg', 0, 'Chassis')`);
    await page.goto("/build?b=xr1");
    await expect(preview).toHaveAttribute("data-mode", "layers");
    await expect(preview.locator("img.es-rb-layer")).toHaveCount(1);
    // The staff image replaces the drawn chassis; the rest of the drawing stays.
    await expect(preview.locator('[data-part="chassis"]')).toHaveCount(0);
    await expect(preview.locator('[data-part="seat"]').first()).toHaveAttribute("data-state", "ghost");
    exec(`delete from builder_layers`);
  });

  test("preview: a motion build with triple screens lights up the platform and all three screens", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "reads shared layer rows");
    exec(`delete from builder_layers`);
    await page.goto("/build?b=xr1,sr2,quad-mount,aoc-32*3");
    const preview = page.getByTestId("rig-preview");
    for (const part of ["chassis", "motion", "mount", "mount-sides", "screen-center", "screen-sides"]) {
      await expect(preview.locator(`[data-part="${part}"]`).first(), part).toHaveAttribute("data-state", "on");
    }
    await expect(preview.locator('[data-part="screen-top"]')).toHaveCount(0);
    await expect(preview.locator('[data-part="wheel"]').first()).toHaveAttribute("data-state", "ghost");
    // the frame sits on the platform: its raised render is used
    await expect(preview).toHaveAttribute("data-raised", "true");
    await expect(preview.locator('[data-part="chassis"]')).toHaveAttribute("src", /chassis--raised\.[0-9a-f]+\.webp$/);
  });

  test("preview: screens match the monitor count exactly; a fourth adds the separate top screen", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "reads shared layer rows");
    exec(`delete from builder_layers`);
    const preview = page.getByTestId("rig-preview");
    const shown = async () => (await preview.locator('[data-part^="screen-"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-part")))).sort();
    await page.goto("/build?b=xr1,quad-mount,aoc-32");
    await expect.poll(shown).toEqual(["screen-center"]);
    await page.goto("/build?b=xr1,quad-mount,aoc-32*2");
    await expect.poll(shown).toEqual(["screen-dual"]);
    await page.goto("/build?b=xr1,quad-mount,aoc-32*3");
    await expect.poll(shown).toEqual(["screen-center", "screen-sides"]);
    await page.goto("/build?b=xr1,quad-mount,aoc-32*4");
    await expect.poll(shown).toEqual(["screen-center", "screen-sides", "screen-top"]);
    await expect(preview.locator('[data-part="mount-top"]')).toHaveAttribute("data-state", "on");
  });

  test("preview: an empty build shows one ghosted render, and it loads", async ({ page }) => {
    await page.goto("/build");
    const ghost = page.getByTestId("rig-preview").locator('[data-part="ghost"]');
    await expect(ghost).toHaveCount(1);
    await expect.poll(() => ghost.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBeGreaterThan(0);
    await expect(page.getByTestId("rig-preview").locator(".es-rp-layer")).toHaveCount(0);
  });

  test("preview: on phones it leads the step, on desktop it sits in the side panel", async ({ page }, info) => {
    await page.goto("/build?b=xr1");
    const preview = page.getByTestId("rig-preview");
    const heading = page.getByRole("heading", { level: 2, name: "Chassis" });
    const [p, h] = await Promise.all([preview.boundingBox(), heading.boundingBox()]);
    if (info.project.name === "mobile") expect(p!.y).toBeLessThan(h!.y);
    else expect(await preview.evaluate((el) => !!el.closest("aside"))).toBe(true);
  });

  test.describe("staff", () => {
    test.use({ storageState: authFile("admin") });
    test("staff set a badge in Staff > Builder and it shows on /build", async ({ page }, info) => {
      test.skip(info.project.name !== "desktop", "mutates shared catalogue rows");
      exec(`update catalog_products set builder_badge = null where builder_badge is not null`);
      await page.goto("/staff/builder");
      await page.getByRole("button", { name: "Wheelbase", exact: true }).click();
      await page.getByLabel("Badge for Alpha 15nm Wheelbase").selectOption("flagship");
      await expect.poll(() => sql<{ b: string }>(`select builder_badge b from catalog_products where sku = 'alpha-15'`)[0].b).toBe("flagship");
      await page.goto("/build?step=wheelbase");
      await expect(page.getByTestId("builder-card-alpha-15").getByTestId("builder-badge")).toHaveText("Flagship");
    });
  });
});

test.describe("rig builder: archived prebuilds", () => {
  // Adds its own archived and draft prebuilds (never published) so no other test sees a changed row.
  test("only published prebuilds are offered as starting points and footer links", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "inserts shared rows; run once");
    exec(`insert into prebuilds (slug, name, status, price_ex_gst) values
      ('e2e-archived-rig', 'E2E Archived Rig', 'archived', 1000),
      ('e2e-draft-rig', 'E2E Draft Rig', 'draft', 1000)
      on conflict (slug) do update set status = excluded.status`);
    const published = sql<{ name: string }>("select name from prebuilds where status = 'published' order by sort_order").map((r) => r.name);
    await page.goto("/build");
    const chips = page.locator(".es-rb-chip");
    await expect(chips).toHaveText(published);
    const footer = page.locator("footer");
    await expect(footer.getByRole("link", { name: published[0], exact: true })).toBeVisible();
    for (const name of ["E2E Archived Rig", "E2E Draft Rig"]) {
      await expect(chips.filter({ hasText: name })).toHaveCount(0);
      await expect(footer.getByRole("link", { name, exact: true })).toHaveCount(0);
    }
  });
});
