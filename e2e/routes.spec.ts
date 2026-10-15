import AxeBuilder from "@axe-core/playwright";
import { test, expect, authFile, type Role } from "./fixtures";

/** Every route in src/App.tsx, with the role that should be able to see it. */
const PUBLIC = [
  "/", "/racing", "/racing/checker", "/racing/prebuilds", "/racing/shop", "/compatibility", "/build", "/shop", "/shop/alpha-15",
  "/prebuilds", "/prebuilds/starter", "/prebuilds/haptic", "/prebuilds/motion", "/builds", "/builds/haptic",
  "/aircraft", "/aircraft/flight", "/aircraft/helicopter", "/drones", "/training", "/training/driver", "/training/industrial",
  "/studio", "/events", "/catering", "/partners", "/guardian", "/ambassadors", "/ambassadors/carter-cosgrove-racing", "/drivers",
  "/guides", "/guides/motion-vs-haptic-vs-static", "/au", "/au/brisbane", "/faqs", "/contact", "/order", "/checkout",
  "/privacy", "/terms", "/login",
];
const APP = ["/app", "/app/quotes", "/app/build", "/app/book", "/app/orders", "/app/service", "/app/chat"];
const STAFF = [
  "/staff", "/staff/crm", "/staff/oms", "/staff/quotes", "/staff/catalog", "/staff/rules", "/staff/prebuilds", "/staff/brands",
  "/staff/jobs", "/staff/bookings", "/staff/service", "/staff/team", "/staff/agent", "/staff/ambassadors",
];

const cases: { path: string; role?: Role }[] = [
  ...PUBLIC.map((path) => ({ path })),
  ...APP.map((path) => ({ path, role: "customer" as Role })),
  { path: "/app/ambassador", role: "driver" },
  ...STAFF.map((path) => ({ path, role: "admin" as Role })),
];

for (const c of cases) {
  test.describe(c.role ?? "anon", () => {
    if (c.role) test.use({ storageState: authFile(c.role) });
    test(`route ${c.path}`, async ({ page, problems }, info) => {
      const res = await page.goto(c.path, { waitUntil: "networkidle" });
      expect.soft(res?.status(), "HTTP status").toBeLessThan(400);
      await page.waitForTimeout(300);
      if (c.path !== "/login") expect.soft(new URL(page.url()).pathname, "no unexpected redirect").not.toBe("/login");
      await expect.soft(page.locator("h1").first(), "has an h1").toBeVisible();
      expect.soft(await page.title(), "title").not.toBe("");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect.soft(overflow, "no horizontal overflow").toBeLessThanOrEqual(1);
      const notFound = await page.getByRole("heading", { name: /not found/i }).count();
      expect.soft(notFound, "not a 404 page").toBe(0);
      const axe = await new AxeBuilder({ page }).analyze();
      const bad = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect.soft(bad.map((v) => `${v.impact} ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target.join(" ")}`), "axe serious/critical").toEqual([]);
      expect.soft(problems.page, "uncaught errors").toEqual([]);
      expect.soft(problems.console, "console errors").toEqual([]);
      expect.soft(problems.network, "failed requests").toEqual([]);
      await info.attach("screenshot", { body: await page.screenshot({ fullPage: false }), contentType: "image/png" });
    });
  });
}

test.describe("404", () => {
  test("unknown route shows a not-found page", async ({ page }) => {
    await page.goto("/definitely-not-a-page");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(/not found|404/i).first()).toBeVisible();
  });
});
