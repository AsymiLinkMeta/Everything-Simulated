import { test, expect, authFile } from "./fixtures";
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
