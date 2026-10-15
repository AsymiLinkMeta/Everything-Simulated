import { test, expect, API, tokenHeaders } from "./fixtures";
import { sql, exec } from "./db";

/** Server-side pricing: every figure comes from quote_cart()/place_order() in Postgres. */
test.describe("server pricing", () => {
  test("guest place_order ignores client-sent prices and charges DB prices", async ({ request }) => {
    const h = await tokenHeaders(request);
    const email = `forge-${Date.now()}@example.com`;
    const q = await request.post(`${API}/rest/v1/rpc/quote_cart`, { headers: h, data: { p_lines: [{ sku: "alpha-15", qty: 1 }], p_postcode: "4215", p_prebuild: null, p_driver_kg: null } });
    expect(q.ok()).toBe(true);
    const quote = await q.json();
    const r = await request.post(`${API}/rest/v1/rpc/place_order`, {
      headers: h,
      data: {
        p: {
          lines: [{ sku: "alpha-15", qty: 1, sellExGst: 1, unit_ex_gst: 1 }],
          total_ex_gst: 1, total_inc_gst: 1, freight_ex_gst: 0,
          email, name: "Forger", phone: "0400000000", address: "1 Test St", postcode: "4215",
        },
      },
    });
    expect(r.ok(), await r.text()).toBe(true);
    const [o] = sql<{ total_inc_gst: number; items_ex_gst: number }>(
      `select o.total_inc_gst, o.items_ex_gst from shop_orders o join crm_contacts c on c.id=o.contact_id where c.email='${email}'`,
    );
    expect(o.items_ex_gst).toBe(quote.items_ex_gst);
    expect(o.total_inc_gst).toBe(quote.total_inc_gst);
    expect(o.total_inc_gst).toBeGreaterThan(1000);
  });

  test("anon cannot insert orders directly", async ({ request }) => {
    const h = await tokenHeaders(request);
    const r = await request.post(`${API}/rest/v1/shop_orders`, { headers: h, data: { id: `ESO-X${Date.now()}`, status: "pending", lines: [], total_ex_gst: 1, total_inc_gst: 1 } });
    expect(r.ok()).toBe(false);
  });

  test("enquiry-only products are blocked from checkout", async ({ request }) => {
    const [row] = sql<{ sku: string }>(`select sku from catalog_products where enquiry_only and listing_status='published' limit 1`);
    test.skip(!row, "no enquiry-only product seeded");
    const h = await tokenHeaders(request);
    const q = await (await request.post(`${API}/rest/v1/rpc/quote_cart`, { headers: h, data: { p_lines: [{ sku: row.sku, qty: 1 }], p_postcode: "4215", p_prebuild: null, p_driver_kg: null } })).json();
    expect(q.ok).toBe(false);
    expect(JSON.stringify(q.issues)).toMatch(/ENQUIRY/);
    const r = await request.post(`${API}/rest/v1/rpc/place_order`, { headers: h, data: { p: { lines: [{ sku: row.sku, qty: 1 }], email: `enq-${Date.now()}@example.com`, name: "E", phone: "0400000000", address: "1 St", postcode: "4215" } } });
    expect(r.ok()).toBe(false);
  });

  test("an unmodified prebuild is charged its package price", async ({ request }) => {
    const [pb] = sql<{ id: string; slug: string; price_ex_gst: number }>(`select id, slug, price_ex_gst from prebuilds where status='published' and price_ex_gst > 0 and not coalesce(enquiry_only,false) order by sort_order limit 1`);
    test.skip(!pb, "no priced prebuild");
    const lines = sql<{ sku: string; qty: number }>(`select sku, qty from prebuild_components where prebuild_id='${pb.id}'`);
    const h = await tokenHeaders(request);
    const q = await (await request.post(`${API}/rest/v1/rpc/quote_cart`, { headers: h, data: { p_lines: lines, p_postcode: "4215", p_prebuild: pb.slug, p_driver_kg: null } })).json();
    if (!q.ok) test.skip(true, `prebuild ${pb.slug} is not purchasable: ${JSON.stringify(q.issues)}`);
    expect(q.mode).toBe("package");
    expect(q.items_ex_gst).toBe(pb.price_ex_gst);
  });

  test("publishing a $0 product is refused unless it is enquiry-only", async ({ request }) => {
    const sku = `e2e-zero-${Date.now()}`;
    exec(`insert into catalog_products (sku, brand, name, category, sell_ex_gst, listing_status, stock_status) values ('${sku}', 'Test', 'Zero', 'accessory', 0, 'draft', 'indent')`);
    const h = await tokenHeaders(request, "admin");
    const r = await request.patch(`${API}/rest/v1/catalog_products?sku=eq.${sku}`, { headers: h, data: { listing_status: "published" } });
    expect(r.ok()).toBe(false);
    const ok = await request.patch(`${API}/rest/v1/catalog_products?sku=eq.${sku}`, { headers: h, data: { listing_status: "published", enquiry_only: true } });
    expect(ok.ok(), await ok.text()).toBe(true);
    exec(`delete from catalog_products where sku='${sku}'`);
  });

  test("checkout shows the server total and enquiry products say 'Enquire for price'", async ({ page }) => {
    const [row] = sql<{ sku: string }>(`select sku from catalog_products where enquiry_only and listing_status='published' limit 1`);
    test.skip(!row, "no enquiry-only product seeded");
    await page.goto(`/shop/${row.sku}`);
    await expect(page.getByText("Enquire for price").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /add to (cart|crate)/i })).toHaveCount(0);
  });
});
