import { test, expect, authFile, API, tokenHeaders } from "./fixtures";
import { sql } from "./db";

/**
 * Logged-out visitors can create a ticket but cannot read support_tickets, so the contact
 * form must not ask for the inserted row back (it failed with an RLS error before).
 */
test("contact form: a logged-out visitor's enquiry reaches staff tickets and the inbox", async ({ page, browser, problems }, info) => {
  const email = `contact-${info.project.name}-${Date.now()}@example.com`;
  await page.goto("/contact");
  await page.getByLabel("Name *").fill("Casey Visitor");
  await page.getByLabel("Email *").fill(email);
  await page.getByLabel("Message *").fill("Do you ship a motion rig to Perth?");
  await page.getByRole("button", { name: "Send to workshop" }).click();
  await expect(page.getByRole("status")).toContainText("Received");
  await expect(page.getByText(email)).toBeVisible();
  expect(problems.network, "no failed requests").toEqual([]);

  const rows = sql<{ id: string; status: string; user_id: string | null; n: number; inbox: number }>(
    `select t.id, t.status, t.user_id,
       (select count(*) from support_messages m where m.ticket_id = t.id)::int n,
       (select count(*) from staff_inbox i where i.ticket_id = t.id)::int inbox
     from support_tickets t where t.contact_email = '${email}'`,
  );
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ status: "open", user_id: null, n: 1, inbox: 1 });

  const staff = await browser.newContext({ storageState: authFile("admin") });
  const sp = await staff.newPage();
  await sp.goto("/staff/service");
  await expect(sp.getByText("Website enquiry from Casey Visitor").first()).toBeVisible();
  await staff.close();
});

test("support integrity: customers and visitors cannot forge workshop replies", async ({ request }, info) => {
  const tag = `${info.project.name}-${Date.now()}`;
  const anon = await tokenHeaders(request);
  const customer = await tokenHeaders(request, "customer");
  const ins = (h: Record<string, string>, table: string, data: object) =>
    request.post(`${API}/rest/v1/${table}`, { headers: { ...h, Prefer: "return=minimal" }, data });

  // A visitor plants a ticket for the customer's email with a fake staff reply.
  const planted = crypto.randomUUID();
  expect((await ins(anon, "support_tickets", {
    id: planted, contact_email: "customer@es.local", contact_name: "x", subject: `Planted ${tag}`, body: "x",
    status: "resolved", staff_reply: "Pay the balance to this account", replied_by: "staff", replied_at: new Date().toISOString(),
  })).ok()).toBe(true);
  expect(sql(`select status, staff_reply, replied_by from support_tickets where id = '${planted}'`)[0]).toEqual({ status: "open", staff_reply: null, replied_by: null });

  // A customer's own ticket: insert with a staff reply, then try to rewrite it.
  const own = crypto.randomUUID();
  expect((await ins(customer, "support_tickets", {
    id: own, contact_email: "customer@es.local", contact_name: "c", subject: `Own ${tag}`, body: "x", staff_reply: "forged", user_id: "someone-else",
  })).ok()).toBe(true);
  const row = sql<{ staff_reply: string | null; user_id: string | null }>(`select staff_reply, user_id from support_tickets where id = '${own}'`)[0];
  expect(row.staff_reply).toBeNull();
  expect(row.user_id).not.toBe("someone-else");
  await request.patch(`${API}/rest/v1/support_tickets?id=eq.${own}`, {
    headers: customer,
    data: { staff_reply: "forged later", status: "resolved", contact_email: "other@example.com" },
  });
  expect(sql(`select staff_reply, status, contact_email from support_tickets where id = '${own}'`)[0]).toEqual({ staff_reply: null, status: "open", contact_email: "customer@es.local" });

  // Messages: author_role 'staff' is downgraded for customers and visitors.
  await ins(customer, "support_messages", { ticket_id: own, author_role: "staff", author_id: "staff-id", body: `as staff ${tag}` });
  await ins(anon, "support_messages", { ticket_id: own, author_role: "staff", body: `anon as staff ${tag}` });
  const roles = sql<{ author_role: string }>(`select author_role from support_messages where ticket_id = '${own}' and body like '%${tag}'`);
  expect(roles.length).toBe(2);
  expect(roles.every((r) => r.author_role === "customer")).toBe(true);

  // Inbox notices from visitors always arrive unread.
  await ins(anon, "staff_inbox", { kind: "contact", subject: `Inbox ${tag}`, body: "x", read_at: new Date().toISOString() });
  expect(sql(`select read_at from staff_inbox where subject = 'Inbox ${tag}'`)[0]).toEqual({ read_at: null });
});

test("guest tickets: a visitor using a customer's email does not reach their account", async ({ request, browser }, info) => {
  const tag = `${info.project.name}-${Date.now()}`;
  const anon = await tokenHeaders(request);
  const customer = await tokenHeaders(request, "customer");
  const planted = crypto.randomUUID();
  const subject = `Change my delivery address ${tag}`;
  expect((await request.post(`${API}/rest/v1/support_tickets`, {
    headers: { ...anon, Prefer: "return=minimal" },
    data: { id: planted, contact_email: "customer@es.local", contact_name: "Imposter", subject, body: "Send it to 9 Other St" },
  })).ok()).toBe(true);
  expect(sql(`select user_id from support_tickets where id = '${planted}'`)[0]).toEqual({ user_id: null });

  // Not readable, not repliable, not listed for the account holder.
  const read = await request.get(`${API}/rest/v1/support_tickets?id=eq.${planted}&select=id`, { headers: customer });
  expect(await read.json()).toEqual([]);
  const post = await request.post(`${API}/rest/v1/support_messages`, {
    headers: { ...customer, Prefer: "return=minimal" },
    data: { ticket_id: planted, author_role: "customer", body: `reply ${tag}` },
  });
  expect(post.ok()).toBe(false);
  const cp = await (await browser.newContext({ storageState: authFile("customer") })).newPage();
  await cp.goto("/app/service");
  await expect(cp.getByRole("heading", { level: 1 })).toBeVisible();
  await cp.waitForLoadState("networkidle");
  await expect(cp.getByText(subject)).toHaveCount(0);

  // A visitor cannot post into a signed-in customer's ticket either.
  const own = crypto.randomUUID();
  expect((await request.post(`${API}/rest/v1/support_tickets`, {
    headers: { ...customer, Prefer: "return=minimal" },
    data: { id: own, contact_email: "someone.else@example.com", contact_name: "C", subject: `Own ${tag}`, body: "x" },
  })).ok()).toBe(true);
  expect(sql(`select contact_email from support_tickets where id = '${own}'`)[0]).toEqual({ contact_email: "customer@es.local" });
  const anonPost = await request.post(`${API}/rest/v1/support_messages`, {
    headers: { ...anon, Prefer: "return=minimal" },
    data: { ticket_id: own, author_role: "customer", body: `anon ${tag}` },
  });
  expect(anonPost.ok()).toBe(false);

  // Staff see it flagged as an unverified guest ticket.
  const sp = await (await browser.newContext({ storageState: authFile("admin") })).newPage();
  await sp.goto("/staff/service");
  await sp.getByText(subject).first().click();
  await expect(sp.getByTestId("guest-ticket")).toBeVisible();
  await info.attach("guest-ticket-staff", { body: await sp.screenshot({ fullPage: true }), contentType: "image/png" });
});
