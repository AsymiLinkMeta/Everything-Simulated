import AxeBuilder from "@axe-core/playwright";
import type { BrowserContext, Page, TestInfo } from "@playwright/test";
import { test, expect, CONSENT_KEY } from "./fixtures";
import { sql, exec } from "./db";

// Every test here starts as a first-time visitor with no cookie choice.
test.use({ consent: null });

const REF_COOKIES = ["es_ref", "es_vid"];
const refCookies = async (ctx: BrowserContext) => (await ctx.cookies()).filter((c) => REF_COOKIES.includes(c.name));
const banner = (page: Page) => page.getByTestId("cookie-consent");
/** Put a build in the cart and land on checkout, where the referral note shows. */
async function toCheckout(page: Page) {
  await page.goto("/prebuilds/haptic");
  await page.getByRole("link", { name: "Buy this build" }).click();
  await expect(page).toHaveURL(/\/checkout/);
}

/** A published ambassador of our own, so parallel tests don't share click counts. */
function ambassador(info: TestInfo, tag: string) {
  const id = `${Date.now().toString(36)}${info.project.name[0]}${tag}`.toUpperCase();
  const slug = `e2e-consent-${id.toLowerCase()}`;
  const code = `CNS${id}`.slice(0, 24);
  const name = `Consent ${id}`;
  exec(`insert into ambassadors (slug, name, code, age_band, published, sort_order) values ('${slug}', '${name}', '${code}', '18+', true, 999)`);
  const clicks = () =>
    sql<{ n: number }>(`select count(*)::int n from referral_clicks c join ambassadors a on a.id = c.ambassador_id where a.slug = '${slug}'`)[0].n;
  return { slug, code, name, clicks, cleanup: () => exec(`delete from ambassadors where slug = '${slug}'`) };
}

test.describe("cookie consent", () => {
  test("first visit: banner with equal Accept / Reject, no referral cookies and no click before a choice", async ({ page, context, problems }, info) => {
    const a = ambassador(info, "pre");
    await page.goto(`/ambassadors/${a.slug}?ref=${a.code}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect.poll(() => new URL(page.url()).searchParams.has("ref")).toBe(false);
    const b = banner(page);
    await expect(b).toBeVisible();
    await expect(b).toHaveAttribute("role", "region");
    await expect(b.getByRole("heading", { name: "Cookies on Everything Simulated" })).toBeVisible();
    const accept = b.getByRole("button", { name: "Accept cookies" });
    const reject = b.getByRole("button", { name: "Reject cookies" });
    const [ab, rb] = [await accept.boundingBox(), await reject.boundingBox()];
    expect(Math.abs(ab!.width - rb!.width)).toBeLessThan(2);
    expect(Math.abs(ab!.height - rb!.height)).toBeLessThan(1);
    expect(ab!.height).toBeGreaterThanOrEqual(44);
    const style = (l: typeof accept) => l.evaluate((el) => { const s = getComputedStyle(el); return [s.backgroundColor, s.color, s.fontWeight, s.borderColor].join("|"); });
    expect(await style(accept)).toBe(await style(reject));
    await expect(b.getByRole("link", { name: "Cookie details" })).toHaveAttribute("href", "/privacy#cookies");
    // The referral is validated but nothing identifying is stored or sent.
    await page.waitForFunction(() => sessionStorage.getItem("es-ref-session") !== null);
    expect(await refCookies(context)).toEqual([]);
    expect(a.clicks()).toBe(0);
    expect(await page.evaluate((k) => localStorage.getItem(k), CONSENT_KEY)).toBeNull();
    const axe = await new AxeBuilder({ page }).include('[data-testid="cookie-consent"]').analyze();
    expect(axe.violations.map((v) => `${v.impact} ${v.id}`)).toEqual([]);
    await info.attach("banner", { body: await page.screenshot(), contentType: "image/png" });
    a.cleanup();
    expect(problems.page).toEqual([]);
    expect(problems.console).toEqual([]);
  });

  test("accept: a referral captured before consent is kept, the click recorded and both cookies set", async ({ page, context }, info) => {
    const a = ambassador(info, "acc");
    await page.goto(`/ambassadors/${a.slug}?ref=${a.code.toLowerCase()}`);
    await page.waitForFunction(() => sessionStorage.getItem("es-ref-session") !== null);
    expect(await refCookies(context)).toEqual([]);
    await banner(page).getByRole("button", { name: "Accept cookies" }).click();
    await expect(banner(page)).toBeHidden();
    await expect.poll(async () => (await refCookies(context)).map((c) => c.name).sort()).toEqual(["es_ref", "es_vid"]);
    const ref = (await context.cookies()).find((c) => c.name === "es_ref")!;
    expect(ref.value).toBe(a.code);
    expect(ref.sameSite).toBe("Lax");
    expect(ref.expires - Date.now() / 1000).toBeGreaterThan(89 * 86400);
    await expect.poll(() => a.clicks()).toBe(1);
    expect(await page.evaluate(() => sessionStorage.getItem("es-ref-session"))).toBeNull();
    const rec = JSON.parse((await page.evaluate((k) => localStorage.getItem(k), CONSENT_KEY))!);
    expect(rec).toMatchObject({ v: 1, referral: true });
    expect(Date.parse(rec.ts)).toBeGreaterThan(Date.now() - 60_000);
    // Survives a reload; the banner stays dismissed and the cart is prefilled for checkout.
    await toCheckout(page);
    await expect(banner(page)).toBeHidden();
    await expect(page.getByText(`credited to ${a.name}`)).toBeVisible();
    a.cleanup();
  });

  test("reject: no referral cookies, no click, but this visit's order is still credited", async ({ page, context }, info) => {
    const a = ambassador(info, "rej");
    await page.goto(`/?ref=${a.code}`);
    await banner(page).getByRole("button", { name: "Reject cookies" }).click();
    await expect(banner(page)).toBeHidden();
    await page.waitForTimeout(500);
    expect(await refCookies(context)).toEqual([]);
    expect(a.clicks()).toBe(0);
    expect(JSON.parse((await page.evaluate((k) => localStorage.getItem(k), CONSENT_KEY))!)).toMatchObject({ v: 1, referral: false });
    // Nothing about the referral is saved beyond this tab.
    const cart = await page.evaluate(() => localStorage.getItem("es-cart-v2"));
    expect(cart ?? "").not.toContain(a.code);
    await toCheckout(page);
    await expect(page.getByText(`credited to ${a.name}`)).toBeVisible();
    expect(await refCookies(context)).toEqual([]);
    // A new tab (new session) has no referral.
    const other = await context.newPage();
    await other.goto("/checkout");
    await expect(other.getByText(/Enter an ambassador code/)).toBeVisible();
    a.cleanup();
  });

  test("Cookie settings reopens the banner; withdrawing consent removes the cookies", async ({ page, context }, info) => {
    const a = ambassador(info, "wd");
    await page.goto(`/?ref=${a.code}`);
    await banner(page).getByRole("button", { name: "Accept cookies" }).click();
    await expect.poll(async () => (await refCookies(context)).length).toBe(2);
    const settings = page.locator("footer").getByRole("button", { name: "Cookie settings" });
    await settings.focus();
    await page.keyboard.press("Enter");
    await expect(banner(page)).toBeVisible();
    await expect(banner(page).getByTestId("cookie-consent-status")).toContainText("Accepted");
    await expect(banner(page).getByRole("heading", { name: "Cookies on Everything Simulated" })).toBeFocused();
    await expect(banner(page).getByRole("button", { name: "Accept cookies" })).toHaveAttribute("aria-pressed", "true");
    // Escape keeps the choice and returns focus.
    await page.keyboard.press("Escape");
    await expect(banner(page)).toBeHidden();
    await expect(settings).toBeFocused();
    expect((await refCookies(context)).length).toBe(2);
    await settings.click();
    await banner(page).getByRole("button", { name: "Reject cookies" }).click();
    await expect.poll(async () => (await refCookies(context)).length).toBe(0);
    await expect(settings).toBeFocused();
    // Still credited for the rest of this visit only.
    await toCheckout(page);
    await expect(page.getByText(`credited to ${a.name}`)).toBeVisible();
    a.cleanup();
  });

  test("privacy policy is dated and names every cookie and storage key", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.getByTestId("privacy-updated")).toHaveText("Last updated: 25 October 2026");
    const table = page.getByTestId("cookie-table");
    for (const name of ["es_ref", "es_vid", "es-consent", "sb-…-auth-token", "es-cart-v2", "es-ref-session"]) {
      await expect(table.getByRole("rowheader", { name })).toBeVisible();
    }
    await expect(table.getByRole("row", { name: /^es_ref / })).toContainText("90 days");
    await expect(page.getByRole("heading", { name: "Cookies and similar storage" })).toHaveAttribute("id", "cookies");
    await expect(page.getByText(/Australian Privacy Principles/)).toBeVisible();
    await expect(page.getByText(/APP 5/)).toBeVisible();
    await expect(page.getByRole("link", { name: /oaic\.gov\.au/ })).toBeVisible();
    // The policy's own "Cookie settings" link reopens the banner.
    await banner(page).getByRole("button", { name: "Reject cookies" }).click();
    await page.locator("article").getByRole("button", { name: "Cookie settings" }).click();
    await expect(banner(page)).toBeVisible();
    await expect(banner(page).getByTestId("cookie-consent-status")).toContainText("Rejected");
  });
});
