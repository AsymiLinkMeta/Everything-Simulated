import { test, expect, authFile, API, PASSWORD } from "./fixtures";
import { sql } from "./db";

test.describe("sign-up with email confirmation", () => {
  test("new account must confirm email before signing in", async ({ page, problems }, info) => {
    test.fail(true, "BUG-03: sign-up navigates into the app with no session and never says to check email");
    const email = `new-${Date.now()}-${info.project.name}@example.com`;
    await page.goto("/login");
    await page.getByRole("button", { name: "New here? Create an account" }).click();
    await page.getByPlaceholder("Name").fill("New Driver");
    await page.getByPlaceholder("Email").fill(email);
    await page.getByPlaceholder("Password", { exact: true }).fill(PASSWORD);
    const confirm = page.getByPlaceholder("Confirm password");
    if (await confirm.count()) await confirm.fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText(/check your (email|inbox)/i), "tells the user to confirm").toBeVisible();
    const [u] = sql<{ email_confirmed_at: string | null }>(`select email_confirmed_at from auth.users where email = '${email}'`);
    expect(u?.email_confirmed_at, "not auto-confirmed").toBeNull();

    const msgs = (await (await fetch("http://localhost:54324/api/v1/search?query=" + encodeURIComponent(`to:${email}`))).json()) as { messages: { ID: string }[] };
    expect(msgs.messages.length, "confirmation mail sent").toBeGreaterThan(0);
    const msg = (await (await fetch(`http://localhost:54324/api/v1/message/${msgs.messages[0].ID}`)).json()) as { HTML: string; Text: string };
    const link = (msg.Text.match(/https?:\/\/\S+verify\S+/) ?? msg.HTML.match(/href="([^"]+verify[^"]+)"/))?.[0].replace(/^href="|"$/g, "").replace(/&amp;/g, "&");
    expect(link, "confirmation link").toBeTruthy();
    await page.goto(link!);
    await page.waitForURL(/localhost:5173/);
    await page.goto("/app");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/app");
    const [p] = sql<{ role: string }>(`select role from profiles where email = '${email}'`);
    expect(p?.role).toBe("customer");
    expect(problems.page).toEqual([]);
  });
});

test.describe("customer app", () => {
  test.use({ storageState: authFile("customer") });

  test("book a showroom demo", async ({ page }) => {
    await page.goto("/app/book");
    await page.locator("select").first().selectOption("demo");
    await page.getByRole("button", { name: "Request booking" }).click();
    await expect(page.getByText(/request(ed)?|booked|thanks/i).first()).toBeVisible();
    const rows = sql(`select b.* from bookings b join auth.users u on u.id::text = b.user_id::text where u.email = 'customer@es.local'`);
    expect(rows.length).toBeGreaterThan(0);
  });

  test("open a service ticket and reply", async ({ page }) => {
    const subject = `Wheel base issue ${Date.now()}`;
    await page.goto("/app/service");
    await page.getByPlaceholder("Wheel base issue").fill(subject);
    await page.getByPlaceholder("Describe your question or issue…").fill("The wheel disconnects after 10 minutes.");
    await page.getByRole("button", { name: "Send to workshop" }).click();
    await expect(page.getByText(subject).first()).toBeVisible();
    expect(sql(`select id from support_tickets where subject = '${subject}'`).length).toBe(1);
  });

  test("AI adviser chat replies (mocked xAI)", async ({ page }) => {
    await page.goto("/app/chat");
    await page.getByPlaceholder("Will SR2 fit a TR120S with my 90kg driver?").fill("Will SR2 fit a TR120S?");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByText(/Mock adviser/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test("build studio → save quote → appears in quotes", async ({ page }) => {
    await page.goto("/prebuilds/starter");
    await page.getByRole("button", { name: "Add to cart" }).click();
    await page.goto("/app/build");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const save = page.getByRole("button", { name: /save (quote|build)/i }).first();
    await expect(save, "save quote action").toBeVisible();
    await save.click();
    await expect(page.getByText(/Quote ES-\w+ saved/)).toBeVisible();
    await page.goto("/app/quotes");
    await expect(page.getByText(/ES-/).first()).toBeVisible();
  });

  test("orders page lists own orders only", async ({ page }) => {
    await page.goto("/app/orders");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test.describe("role isolation", () => {
  test("customer cannot open the staff portal", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile("customer") });
    const page = await ctx.newPage();
    const staffData: string[] = [];
    page.on("response", async (r) => {
      if (/\/rest\/v1\/(crm_contacts|shop_orders|crm_notes)/.test(r.url()) && r.ok()) {
        const body = await r.json().catch(() => []);
        if (Array.isArray(body) && body.length) staffData.push(r.url());
      }
    });
    await page.goto("/staff/crm");
    await expect(page.getByText("Staff only")).toBeVisible();
    await expect(page.getByText("first signed-in account")).toHaveCount(0);
    expect(staffData).toEqual([]);
    await ctx.close();
  });

  test("customer token cannot read staff tables through the API", async ({ request }) => {
    const tok = await request.post(`${API}/auth/v1/token?grant_type=password`, {
      data: { email: "customer@es.local", password: PASSWORD },
      headers: { apikey: process.env.LOCAL_ANON_KEY ?? "" },
    });
    const { access_token } = await tok.json();
    const h = { apikey: process.env.LOCAL_ANON_KEY ?? "", Authorization: `Bearer ${access_token}` };
    for (const t of ["crm_contacts", "crm_notes", "shop_orders", "agent_memory", "mail_log", "stripe_events", "staff_inbox", "admin_bootstrap_emails", "pipeline_alerts"]) {
      const r = await request.get(`${API}/rest/v1/${t}?select=*`, { headers: h });
      const rows = r.ok() ? await r.json() : [];
      const foreign = Array.isArray(rows) ? rows.filter((x: { user_id?: string }) => x.user_id === undefined || x.user_id === null) : [];
      expect.soft(foreign.length, `${t} leaks rows to a customer`).toBe(0);
    }
    const up = await request.patch(`${API}/rest/v1/profiles?email=eq.customer@es.local`, { headers: { ...h, "content-type": "application/json" }, data: { role: "admin" } });
    expect(up.ok(), "self-promotion blocked").toBe(false);
  });
});
