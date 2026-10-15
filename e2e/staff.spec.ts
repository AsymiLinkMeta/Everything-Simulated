import { test, expect, authFile, API, tokenHeaders } from "./fixtures";
import { sql, exec } from "./db";

test.use({ storageState: authFile("admin") });

function seedOrder(id: string, opts: { paid?: boolean } = {}) {
  exec(`insert into crm_contacts (id, display_name, email, crm_stage, crm_source) values (gen_random_uuid(), 'Fixture ${id}', '${id.toLowerCase()}@example.com', 'quoted', 'website')`);
  exec(`insert into shop_orders (id, contact_id, status, lines, total_ex_gst, total_inc_gst, shipping_name, postcode${opts.paid ? ", paid_cents, stripe_payment_intent" : ""})
        select '${id}', id, 'pending', '[{"sku":"alpha-15","qty":1}]', 100000, 110000, 'Fixture', '4215'${opts.paid ? ", 33000, 'pi_test_" + id + "'" : ""}
        from crm_contacts where email = '${id.toLowerCase()}@example.com'`);
}

test("OMS: record payment issues one invoice number, pack decrements stock, ship issues tracking", async ({ page }, info) => {
  const id = `ESO-T${Date.now().toString(36).toUpperCase()}${info.project.name[0].toUpperCase()}`;
  seedOrder(id);
  exec(`update catalog_products set qty_on_hand = 5, stock_status = 'stock' where sku = 'alpha-15'`);
  const [{ qty: before }] = sql<{ qty: number }>(`select coalesce(qty_on_hand,0) qty from catalog_products where sku='alpha-15'`);
  const inv = () => sql<{ invoice_number: string | null }>(`select invoice_number from shop_orders where id='${id}'`)[0].invoice_number;
  await page.goto(`/staff/oms/${id}`);

  // Can't jump to paid or packing with nothing received.
  await page.getByRole("button", { name: "packing", exact: true }).click();
  await expect(page.getByText(/payment/i).first()).toBeVisible();
  expect(sql<{ s: string }>(`select status s from shop_orders where id='${id}'`)[0].s).toBe("pending");

  // Part payment issues the invoice; a second payment keeps the same number.
  await page.getByRole("button", { name: "Record payment" }).click();
  await page.getByLabel(`Amount received for ${id}`).fill("330");
  await page.getByRole("button", { name: "Save payment" }).click();
  await expect.poll(inv).toMatch(/^ESI-\d{6}$/);
  const inv1 = inv();
  expect(sql<{ s: string; p: number }>(`select status s, paid_cents p from shop_orders where id='${id}'`)[0]).toEqual({ s: "paid", p: 33000 });
  await page.getByRole("button", { name: "Record payment" }).click();
  await page.getByRole("button", { name: "Save payment" }).click();
  await expect.poll(() => sql<{ p: number }>(`select paid_cents p from shop_orders where id='${id}'`)[0].p).toBe(110000);
  expect(inv(), "invoice number is issued once").toBe(inv1);

  await page.getByRole("button", { name: "packing", exact: true }).click();
  await expect.poll(() => sql<{ qty: number }>(`select coalesce(qty_on_hand,0) qty from catalog_products where sku='alpha-15'`)[0].qty).toBe(before - 1);
  // Issuing tracking ships the order (BUG-08).
  await page.getByRole("button", { name: /Issue tracking/ }).click();
  await expect.poll(() => sql<{ s: string }>(`select status s from shop_orders where id='${id}'`)[0].s).toBe("shipped");
  expect(sql<{ tn: string }>(`select tracking_number tn from shop_orders where id='${id}'`)[0].tn).toBeTruthy();
  await info.attach("oms", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
});

test("OMS: a staff token cannot edit totals or payments directly", async ({ request }) => {
  const id = `ESO-G${Date.now().toString(36).toUpperCase()}`;
  seedOrder(id);
  const h = await tokenHeaders(request, "admin");
  const r = await request.patch(`${API}/rest/v1/shop_orders?id=eq.${id}`, { headers: h, data: { total_inc_gst: 1, paid_cents: 110000 } });
  expect(r.ok()).toBe(false);
  expect(sql<{ total: number; paid: number }>(`select total_inc_gst total, coalesce(paid_cents,0) paid from shop_orders where id='${id}'`)[0]).toEqual({ total: 110000, paid: 0 });
  // Notes are still editable.
  const ok = await request.patch(`${API}/rest/v1/shop_orders?id=eq.${id}`, { headers: h, data: { notes: "call first" } });
  expect(ok.ok()).toBe(true);
});

test("OMS: Stripe refund through the refund-payment function", async ({ page }, info) => {
  const id = `ESO-R${Date.now().toString(36).toUpperCase()}${info.project.name[0].toUpperCase()}`;
  seedOrder(id, { paid: true });
  await page.goto(`/staff/oms/${id}`);
  await page.getByRole("button", { name: "Refund Stripe" }).click();
  await expect(page.getByText(/Refunded/)).toBeVisible();
  // Stripe then sends charge.refunded; deliver it signed through the mock.
  await fetch(`${API}/__mock/stripe/event`, {
    method: "POST",
    body: JSON.stringify({ type: "charge.refunded", object: { id: "ch_x", payment_intent: `pi_test_${id}`, amount_refunded: 33000 } }),
  });
  await expect.poll(() => sql<{ r: number }>(`select refunded_cents r from shop_orders where id='${id}'`)[0].r).toBe(33000);
});

test("compatibility rule: create and it shows in the public checker", async ({ page }) => {
  const reason = `E2E rule ${Date.now()}`;
  await page.goto("/staff/rules");
  await page.getByLabel("Left SKU").fill("tr120s");
  await page.getByLabel("Right SKU").fill("sr2");
  await page.getByLabel("Severity").selectOption("warn");
  await page.getByLabel("Reason (shown to the customer)").fill(reason);
  await page.getByRole("button", { name: "Save rule" }).click();
  await expect(page.getByText(reason)).toBeVisible();
  expect(sql(`select 1 from compatibility_rules where reason='${reason}'`).length).toBe(1);
  exec(`delete from compatibility_rules where reason='${reason}'`);
});

test("bookings: confirm a customer booking", async ({ page }) => {
  exec(`insert into bookings (user_id, kind, slot, status, notes) select id::text, 'demo', 'Sat 10:00', 'requested', 'e2e booking' from auth.users where email='customer@es.local'`);
  await page.goto("/staff/bookings");
  const item = page.locator("li", { hasText: "e2e booking" }).first();
  await item.getByRole("button", { name: "Confirm" }).click();
  await expect(item.getByText("confirmed")).toBeVisible();
});

test("team: create a staff account and change a role", async ({ page }, info) => {
  const email = `tech-${Date.now()}-${info.project.name}@example.com`;
  await page.goto("/staff/team");
  await page.getByPlaceholder("Alex Smith").fill("Tech Person");
  await page.getByPlaceholder("alex@example.com").fill(email);
  await page.getByLabel("Staff role").selectOption("workshop");
  await page.getByPlaceholder("At least 8 characters").fill("TempPassw0rd!");
  await page.getByPlaceholder("Repeat the temporary password").fill("TempPassw0rd!");
  await page.getByRole("button", { name: /create/i }).first().click();
  await expect.poll(() => sql<{ role: string }>(`select role from profiles where email='${email}'`)[0]?.role).toBe("workshop");
});

test("CRM: create a lead and move it to qualified", async ({ page }, info) => {
  const name = `Lead ${Date.now()} ${info.project.name}`;
  const email = `lead-${Date.now()}-${info.project.name}@example.com`;
  await page.goto("/staff/crm");
  await page.getByRole("button", { name: "New lead" }).click();
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Postcode").fill("4000");
  await page.getByRole("button", { name: "Create lead" }).click();
  await expect(page.getByText(name).first()).toBeVisible();
  await expect.poll(() => sql<{ s: string }>(`select crm_stage s from crm_contacts where email='${email}'`)[0]?.s).toBe("lead");
  const card = page.locator(".es-board > *").filter({ hasText: name }).first().locator("select");
  if (await card.count()) {
    await card.first().selectOption("qualified");
    await expect.poll(() => sql<{ s: string }>(`select crm_stage s from crm_contacts where email='${email}'`)[0]?.s).toBe("qualified");
  }
});

test("prebuilds: edit a prebuild and the public page updates", async ({ page }) => {
  const kicker = `E2E ${Date.now()}`;
  const [{ kicker: original }] = sql<{ kicker: string }>(`select kicker from prebuilds where slug='starter'`);
  await page.goto("/staff/prebuilds");
  const row = page.locator("li, tr, div.es-card").filter({ hasText: "Starter Rig" }).first();
  await row.getByRole("button", { name: "Edit" }).click();
  await page.getByPlaceholder("e.g. Entry Level").fill(kicker);
  await page.getByRole("button", { name: "Save Prebuild" }).click();
  await expect.poll(() => sql<{ k: string }>(`select kicker k from prebuilds where slug='starter'`)[0].k).toBe(kicker);
  await page.goto("/prebuilds/starter");
  await expect(page.getByText(kicker).first()).toBeVisible();
  exec(`update prebuilds set kicker = ${original === null ? "null" : `'${original.replace(/'/g, "''")}'`} where slug='starter'`);
});

test("brands: add a brand, it lists, then delete it", async ({ page }, info) => {
  const brand = `E2E Brand ${Date.now()} ${info.project.name}`;
  await page.goto("/staff/brands");
  await page.getByRole("button", { name: "Add brand" }).click();
  await page.getByPlaceholder("e.g. Simagic").fill(brand);
  await page.getByPlaceholder("https://simagic.com").fill("https://example.com");
  await page.getByRole("button", { name: "Save brand" }).click();
  await expect(page.getByText(brand).first()).toBeVisible();
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: `Delete brand ${brand}` }).click();
  await expect.poll(() => sql(`select 1 from brands where name='${brand}'`).length).toBe(0);
});

test("jobs board: move a job through stages", async ({ page }) => {
  const note = `e2e job ${Date.now()}`;
  exec(`insert into jobs (stage, notes) values ('enquiry', '${note}')`);
  const [{ id }] = sql<{ id: number }>(`select id from jobs where notes='${note}'`);
  await page.goto("/staff/jobs");
  const card = page.locator("li").filter({ hasText: `#${id}` }).first();
  await card.getByRole("button", { name: "build", exact: true }).click();
  await expect.poll(() => sql<{ s: string }>(`select stage s from jobs where id=${id}`)[0].s).toBe("build");
  await page.locator("li").filter({ hasText: `#${id}` }).first().getByRole("button", { name: "qa", exact: true }).click();
  await expect.poll(() => sql<{ s: string }>(`select stage s from jobs where id=${id}`)[0].s).toBe("qa");
});

test("catalogue: AI listing generates a draft (mocked xAI)", async ({ page }) => {
  await page.goto("/staff/catalog");
  await page.getByRole("button", { name: "New product" }).click();
  const url = page.getByPlaceholder(/https?:\/\//).first();
  await url.fill("https://example.com/wheelbase");
  await page.getByRole("button", { name: /generate/i }).first().click();
  await expect(page.getByText("Draft generated by Grok — review every field before saving.")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('input[value="Mock listing title"]').first()).toBeVisible();
});

test("service: staff reply reaches the customer ticket", async ({ page }) => {
  const subject = `Ticket ${Date.now()}`;
  exec(`insert into support_tickets (user_id, contact_email, subject, body, status) select id::text, email, '${subject}', 'help', 'open' from auth.users where email='customer@es.local'`);
  await page.goto("/staff/service");
  await page.getByRole("button", { name: "Tickets", exact: true }).click();
  await page.getByText(subject).first().click();
  await page.getByPlaceholder("Reply in the customer app…").fill("We will call you.");
  await page.getByRole("button", { name: "Send to customer app" }).click();
  await expect(page.getByText("We will call you.").first()).toBeVisible();
});
