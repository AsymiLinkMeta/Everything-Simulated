import fs from "node:fs";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import type { Browser, Page } from "@playwright/test";
import { test, expect, API, authFile } from "./fixtures";
import { sql, exec } from "./db";

const SLUG = "carter-cosgrove-racing";
const CODE = "COSGROVE";

const setSetting = (key: string, json: string) => exec(`update ambassador_settings set value = '${json}'::jsonb where key = '${key}'`);
const asStaff = async (browser: Browser) => (await browser.newContext({ storageState: authFile("admin") })).newPage();

test.describe("referral links", () => {
  test("ref link sets the first-party cookie, strips the param and records one click", async ({ page, problems, context }, info) => {
    // Own published ambassador so parallel tests don't move the click count.
    const tag = `${Date.now().toString(36)}${info.project.name[0]}`.toUpperCase();
    const slug = `e2e-click-${tag.toLowerCase()}`;
    const code = `CLK${tag}`.slice(0, 24);
    exec(`insert into ambassadors (slug, name, code, age_band, published, sort_order) values ('${slug}', 'Click ${tag}', '${code}', '18+', true, 999)`);
    const clicks = () =>
      sql<{ n: number; path: string }>(`select count(*)::int n, min(landing_path) path from referral_clicks c join ambassadors a on a.id = c.ambassador_id where a.slug = '${slug}'`)[0];

    await page.goto(`/ambassadors/${slug}?ref=${code.toLowerCase()}&utm_source=ig`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect.poll(() => new URL(page.url()).searchParams.has("ref")).toBe(false);
    expect(new URL(page.url()).searchParams.get("utm_source")).toBe("ig");
    await expect.poll(async () => (await context.cookies()).find((c) => c.name === "es_ref")?.value).toBe(code);
    const ref = (await context.cookies()).find((c) => c.name === "es_ref")!;
    expect(ref.sameSite).toBe("Lax");
    expect(ref.expires - Date.now() / 1000).toBeGreaterThan(89 * 86400);
    await expect.poll(() => clicks().n).toBe(1);
    expect(clicks().path).toBe(`/ambassadors/${slug}`);
    // Same visitor, same day: still one click.
    await page.goto(`/ambassadors/${slug}?ref=${code}`);
    await expect.poll(() => new URL(page.url()).searchParams.has("ref")).toBe(false);
    await page.waitForTimeout(500);
    expect(clicks().n).toBe(1);
    // Nothing identifying is stored.
    const cols = sql<{ c: string }>(`select column_name c from information_schema.columns where table_name = 'referral_clicks'`).map((r) => r.c);
    expect(cols.some((c) => /ip|agent|email/.test(c))).toBe(false);
    exec(`delete from ambassadors where slug = '${slug}'`);
    expect(problems.page).toEqual([]);
    expect(problems.console).toEqual([]);
  });

  test("profile QR code downloads as PNG and SVG and encodes the referral link", async ({ page }, info) => {
    await page.goto(`/ambassadors/${SLUG}`);
    await page.getByRole("button", { name: "Show QR Code" }).click();
    await expect(page.getByTestId("qr-code").first()).toBeVisible();
    for (const kind of ["PNG", "SVG"] as const) {
      const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: `Download ${kind}` }).first().click()]);
      expect(dl.suggestedFilename()).toMatch(new RegExp(`\\.${kind.toLowerCase()}$`));
      const file = await dl.path();
      const head = fs.readFileSync(file!).subarray(0, 8);
      if (kind === "PNG") {
        expect(head[1]).toBe(0x50);
        const png = PNG.sync.read(fs.readFileSync(file!));
        const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
        expect(decoded?.data).toMatch(new RegExp(`/ambassadors/${SLUG}\\?ref=${CODE}$`));
      } else expect(fs.readFileSync(file!, "utf8")).toContain("<svg");
    }
    await info.attach("profile", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  });

  test("anon cannot read clicks, settings or commissions", async ({ request }) => {
    const h = { apikey: process.env.LOCAL_ANON_KEY ?? "", Authorization: `Bearer ${process.env.LOCAL_ANON_KEY ?? ""}` };
    for (const t of ["referral_clicks", "ambassador_settings", "ambassador_commissions", "ambassador_guardians", "ambassador_terms"]) {
      const r = await request.get(`${API}/rest/v1/${t}?select=*`, { headers: h });
      expect(r.ok(), t).toBe(false);
    }
    const u = await request.get(`${API}/rest/v1/ambassadors?select=user_id`, { headers: h });
    expect(u.ok()).toBe(false);
  });
});

// These change programme-wide settings, so they run once (desktop) and in order.
test.describe("programme (staff)", () => {
  test.describe.configure({ mode: "serial" });
  // Playwright needs the destructuring pattern for the fixtures argument.
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop", "programme settings are global; run once"));
  // eslint-disable-next-line no-empty-pattern
  test.afterAll(({}, info) => {
    if (info.project.name !== "desktop") return;
    exec(`delete from ambassadors where slug like 'e2e-minor-%'`);
    setSetting("default_commission_rate", "null");
    setSetting("guardian_method", '"staff"');
  });

  test("referred order: pending without a rate, staff warning, rate set, approved on balance, paid out, CSV", async ({ page, browser }, info) => {
    setSetting("default_commission_rate", "null");
    exec(`delete from ambassador_terms where ambassador_id = (select id from ambassadors where code = '${CODE}')`);
    const email = `ref-${Date.now()}@example.com`;
    await page.goto(`/?ref=${CODE}`);
    await expect.poll(async () => (await page.context().cookies()).find((c) => c.name === "es_ref")?.value).toBe(CODE);
    await page.goto("/prebuilds/haptic");
    await page.getByRole("link", { name: "Checkout this crate" }).click();
    await page.getByPlaceholder("Jane Smith").fill("Referred Buyer");
    await page.getByPlaceholder("jane@example.com").fill(email);
    await page.getByPlaceholder("04xx xxx xxx").fill("0400 000 000");
    await page.getByPlaceholder("Street, suburb, state").fill("1 Test St, Southport QLD");
    await page.getByRole("button", { name: /Pay .* deposit/ }).click();
    await page.getByRole("button", { name: /^Pay/ }).click({ timeout: 20_000 });
    await page.waitForURL(/\/order/, { timeout: 20_000 });

    const [order] = sql<{ id: string; code: string; source: string }>(
      `select o.id, a.code, o.referral_source source from shop_orders o join crm_contacts c on c.id = o.contact_id
         left join ambassadors a on a.id = o.referral_ambassador_id where c.email = '${email}'`,
    );
    expect(order.code, "order attributed from the cookie").toBe(CODE);
    expect(order.source).toBe("checkout");
    const comm = () => sql<{ status: string; amount: number | null; basis: number }>(
      `select status, amount_cents amount, basis_ex_gst basis from ambassador_commissions where order_id = '${order.id}'`,
    )[0];
    await expect.poll(() => comm()?.status).toBe("pending");
    expect(comm().amount).toBeNull();

    const staff = await asStaff(browser);
    await staff.goto("/staff/ambassadors");
    await expect(staff.getByTestId("default-rate-warning")).toBeVisible();
    await info.attach("staff-warning", { body: await staff.screenshot({ fullPage: true }), contentType: "image/png" });
    await staff.getByRole("tab", { name: "Programme settings" }).click();
    await staff.getByLabel("Default commission rate percent").fill("5");
    await staff.getByRole("button", { name: "Save default rate" }).click();
    await expect(staff.getByTestId("default-rate-warning")).toHaveCount(0);
    await expect.poll(() => comm().amount).toBe(Math.round(comm().basis * 0.05));

    // Balance paid -> approved.
    await staff.goto(`/staff/oms/${order.id}`);
    await staff.getByRole("button", { name: "Record payment" }).click();
    await staff.getByRole("button", { name: "Save payment" }).click();
    await expect.poll(() => comm().status).toBe("approved");

    // Payout and CSV.
    await staff.goto("/staff/ambassadors");
    await staff.getByRole("tab", { name: "Commissions & payouts" }).click();
    const table = staff.getByTestId("commission-report");
    await expect(table).toContainText(order.id);
    const [dl] = await Promise.all([staff.waitForEvent("download"), staff.getByRole("button", { name: "Export CSV" }).click()]);
    const csv = fs.readFileSync((await dl.path())!, "utf8");
    expect(csv).toContain(order.id);
    expect(csv.split("\r\n")[0]).toMatch(/ambassador/i);
    await staff.getByLabel(`Select commission on ${order.id}`).check();
    await staff.getByLabel("Payment reference").fill("EFT e2e");
    await staff.getByRole("button", { name: "Mark paid" }).click();
    await expect.poll(() => comm().status).toBe("paid");
    await info.attach("payouts", { body: await staff.screenshot({ fullPage: true }), contentType: "image/png" });

    // The driver sees it on their dashboard.
    const driver = await (await browser.newContext({ storageState: authFile("driver") })).newPage();
    await driver.goto("/app/ambassador");
    await expect(driver.getByTestId("ambassador-stats")).toContainText("Sales");
    await expect(driver.getByText(`…${order.id.slice(-4)}`).first()).toBeVisible();
    await info.attach("driver-dashboard", { body: await driver.screenshot({ fullPage: true }), contentType: "image/png" });
  });

  async function fixtureMinor(tag: string) {
    const id = Date.now().toString(36);
    const slug = `e2e-minor-${tag}-${id}`;
    const code = `E2E${id.toUpperCase().slice(-6)}${tag[0].toUpperCase()}`;
    const name = `Minor ${tag} ${id}`;
    exec(`insert into ambassadors (slug, name, code, age_band, published, sort_order) values ('${slug}', '${name}', '${code}', '12-15', false, 999)`);
    return { slug, code, name };
  }
  const guardian = (slug: string) =>
    sql<{ status: string; method: string | null }>(`select g.status, g.method from ambassador_guardians g join ambassadors a on a.id = g.ambassador_id where a.slug = '${slug}'`)[0];

  async function openProgramme(staff: Page, name: string) {
    await staff.goto("/staff/ambassadors");
    const row = staff.locator(".es-card", { hasText: name }).first();
    await row.getByRole("button", { name: "Programme" }).click();
    return row.getByTestId("guardian-card");
  }

  test("under-18: blocked from publishing until staff record the guardian's approval", async ({ browser }, info) => {
    setSetting("guardian_method", '"staff"');
    const m = await fixtureMinor("staff");
    expect(() => exec(`update ambassadors set published = true where slug = '${m.slug}'`)).toThrow(/guardian/i);
    const staff = await asStaff(browser);
    const card = await openProgramme(staff, m.name);
    await card.getByLabel("Guardian name").fill("Pat Parent");
    await card.getByLabel("Guardian email").fill("pat.parent@example.com");
    await card.getByRole("button", { name: "Save" }).click();
    await expect.poll(() => guardian(m.slug).status).toBe("pending");
    await expect(card.getByRole("button", { name: "Send approval email" })).toHaveCount(0);
    await card.getByLabel(/How did the guardian approve/).fill("Signed form on file");
    await card.getByRole("button", { name: "Record guardian approval" }).click();
    await expect.poll(() => guardian(m.slug)).toEqual({ status: "approved", method: "staff" });
    exec(`update ambassadors set published = true where slug = '${m.slug}'`);
    await info.attach("guardian-staff", { body: await staff.screenshot({ fullPage: true }), contentType: "image/png" });
  });

  test("under-18: email method sends a single-use approval link", async ({ browser, page }, info) => {
    setSetting("guardian_method", '"email"');
    await fetch(`${API}/__mock/reset`, { method: "POST" });
    const m = await fixtureMinor("email");
    const staff = await asStaff(browser);
    const card = await openProgramme(staff, m.name);
    await card.getByLabel("Guardian name").fill("Sam Guardian");
    await card.getByLabel("Guardian email").fill("sam.guardian@example.com");
    await card.getByRole("button", { name: "Save" }).click();
    await card.getByRole("button", { name: "Send approval email" }).click();
    let link = "";
    await expect
      .poll(async () => {
        const mail = (await (await fetch(`${API}/__mock/mail`)).json()) as { to: string[]; html: string }[];
        const hit = mail.find((x) => x.to.includes("sam.guardian@example.com"));
        link = /href="([^"]*\/guardian#t=[^"]+)"/.exec(hit?.html ?? "")?.[1] ?? "";
        return link;
      })
      .toContain("#t=");
    const token = link.split("#t=")[1];
    await page.goto(`/guardian#t=${token}`);
    await expect(page.getByText("Sam Guardian", { exact: false })).toBeVisible();
    await info.attach("guardian-email-page", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    await page.getByRole("button", { name: "I approve" }).click();
    await expect(page.getByTestId("guardian-done")).toContainText("approved");
    await expect.poll(() => guardian(m.slug)).toEqual({ status: "approved", method: "email" });
    // Single use.
    await page.goto("/");
    await page.goto(`/guardian#t=${token}`);
    await expect(page.getByText(/expired or has already been used/)).toBeVisible();
  });
});

test.describe("driver portal", () => {
  test.use({ storageState: authFile("driver") });
  test("Ambassador tab shows the share kit and dashboard", async ({ page, problems }) => {
    await page.goto("/app");
    await expect(page.locator('a[href="/app/ambassador"]').first()).toBeAttached();
    await page.goto("/app/ambassador");
    await expect(page.getByLabel("Your referral link")).toHaveValue(new RegExp(`/ambassadors/${SLUG}\\?ref=${CODE}$`));
    await expect(page.getByTestId("ambassador-stats")).toBeVisible();
    expect(problems.page).toEqual([]);
  });
});
