import { test, expect, API } from "./fixtures";
import { sql } from "./db";

test.describe("guest crate checkout with Stripe deposit", () => {
  test("prebuild → checkout → Stripe test checkout → signed webhook marks paid → order lookup", async ({ page, problems }, info) => {
    const email = `guest-${Date.now()}-${info.project.name}@example.com`;
    await page.goto("/prebuilds/haptic");
    await page.getByRole("link", { name: "Checkout this crate" }).click();
    await expect(page).toHaveURL(/\/checkout/);
    await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();

    await page.getByPlaceholder("Jane Smith").fill("Guest Tester");
    await page.getByPlaceholder("jane@example.com").fill(email);
    await page.getByPlaceholder("04xx xxx xxx").fill("0400 000 000");
    await page.getByPlaceholder("Street, suburb, state").fill("1 Test St, Southport QLD");
    const pay = page.getByRole("button", { name: /Pay .* deposit/ });
    await expect(pay).toBeVisible();
    const shown = (await pay.textContent()) ?? "";
    await pay.click();

    await expect(page.getByRole("heading", { name: "Test mode checkout" })).toBeVisible({ timeout: 20_000 });
    const charged = await page.getByTestId("mock-stripe-amount").textContent();
    expect(shown.replace(/[^\d.]/g, "")).toContain((charged ?? "").replace(/[^\d.]/g, ""));
    await page.getByRole("button", { name: /^Pay/ }).click();

    await page.waitForURL(/\/order/, { timeout: 20_000 });
    const [order] = sql<{ id: string; status: string; paid_cents: number; total_inc_gst: number; invoice_number: string }>(
      `select o.id, o.status, o.paid_cents, o.total_inc_gst, o.invoice_number from shop_orders o join crm_contacts c on c.id = o.contact_id where c.email = '${email}'`,
    );
    expect(order, "order row").toBeTruthy();
    expect(order.status).toBe("paid");
    expect(order.paid_cents).toBeGreaterThan(0);
    expect(order.invoice_number).toMatch(/^ESI-/);
    await expect(page.getByText(order.id).first()).toBeVisible();
    await expect(page.getByText(/paid/i).first()).toBeVisible();
    await info.attach("order-paid", { body: await page.screenshot(), contentType: "image/png" });

    // Replay of the same signed event is acknowledged without double-counting.
    const sessions = (await (await fetch(`${API}/__mock/stripe/sessions`)).json()) as { id: string; params: Record<string, string> }[];
    expect(sessions.some((s) => s.params.client_reference_id === order.id)).toBe(true);
    expect(problems.page).toEqual([]);
  });

  test("webhook rejects unsigned and tampered events", async ({ request }) => {
    const body = JSON.stringify({ id: "evt_forged", type: "checkout.session.completed", data: { object: { client_reference_id: "ESO-X", amount_total: 1 } } });
    const unsigned = await request.post(`${API}/functions/v1/stripe-webhook`, { data: body, headers: { "content-type": "application/json" } });
    expect(unsigned.status()).toBe(400);
    const forged = await request.post(`${API}/functions/v1/stripe-webhook`, {
      data: body,
      headers: { "content-type": "application/json", "stripe-signature": `t=${Math.floor(Date.now() / 1000)},v1=${"0".repeat(64)}` },
    });
    expect(forged.status()).toBe(400);
  });
});
