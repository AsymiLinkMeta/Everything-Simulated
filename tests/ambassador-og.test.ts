import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ supabase: {}, supabaseUrl: "", supabaseAnonKey: "" }));
import fs from "node:fs";
import { renderAmbassadorHtml } from "../scripts/seo-files";
import { commissionsToCsv } from "../src/lib/es/ambassadors";
import { parsePercent } from "../src/components/es/ambassador-staff";

const template = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const origin = "https://example.test";

describe("ambassador OG shell", () => {
  it("rewrites the head tags for the profile", () => {
    const html = renderAmbassadorHtml(template, origin, {
      slug: "jane-doe",
      updated_at: null,
      name: 'Jane "JD" <Doe>',
      bio: "Karting  champion\nand sim racer.",
      photo: "https://cdn.example.test/jane.jpg",
    })!;
    expect(html).toContain("<title>Jane &quot;JD&quot; &lt;Doe&gt; | Ambassador | Everything Simulated</title>");
    expect(html).toContain('<link rel="canonical" href="https://example.test/ambassadors/jane-doe" />');
    expect(html).toContain('<meta property="og:image" content="https://cdn.example.test/jane.jpg" />');
    expect(html).toContain('<meta property="og:type" content="profile" />');
    expect(html).toContain('content="Karting champion and sim racer."');
    expect(html).not.toContain("<Doe>");
  });

  it("refuses unsafe slugs and falls back to the default image for non-https photos", () => {
    expect(renderAmbassadorHtml(template, origin, { slug: "../etc", updated_at: null, name: "x" })).toBeNull();
    const html = renderAmbassadorHtml(template, origin, { slug: "a1", updated_at: null, name: "A", photo: "javascript:alert(1)" })!;
    expect(html).toContain(`<meta property="og:image" content="${origin}/og.jpg" />`);
  });
});

describe("commission CSV and rate parsing", () => {
  it("quotes cells and neutralises formulas", () => {
    const csv = commissionsToCsv([
      {
        commission_id: "c1", ambassador_id: "a1", ambassador_name: "=HYPERLINK(\"x\")", ambassador_code: "AB1",
        order_id: "ES-1", invoice_number: null, order_date: "2026-10-01T00:00:00Z", basis_ex_gst: 100000, rate: 0.05,
        amount_cents: 5000, status: "approved", void_reason: null, payout_id: null, payout_reference: null, paid_at: null,
        guardian_ok: true,
      },
    ] as never);
    expect(csv).toContain("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csv.split("\r\n").length).toBeGreaterThan(1);
  });
  it("parses percentages", () => {
    expect(parsePercent("")).toBeNull();
    expect(parsePercent("5")).toBe(0.05);
    expect(parsePercent("7.5%")).toBe(0.075);
    expect(() => parsePercent("60")).toThrow();
    expect(() => parsePercent("abc")).toThrow();
  });
});
