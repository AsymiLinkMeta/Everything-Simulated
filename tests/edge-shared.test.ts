import { describe, expect, it } from "vitest";
import { escapeHtml, escapeMultiline, safeHeader } from "../supabase/functions/_shared/html.ts";
import { authorizeMail, type MailCaller } from "../supabase/functions/_shared/mail-auth.ts";
import { allowedOrigins, corsHeadersFor, withCors } from "../supabase/functions/_shared/cors.ts";
import { checkoutReturnUrls, DEFAULT_SITE_URL, resolveSiteUrl } from "../supabase/functions/_shared/site.ts";

describe("escapeHtml", () => {
  it("neutralises markup and attribute breakouts", () => {
    expect(escapeHtml(`<img src=x onerror="alert('1')">&`)).toBe("&lt;img src=x onerror=&quot;alert(&#39;1&#39;)&quot;&gt;&amp;");
  });
  it("handles null/undefined/numbers", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
    expect(escapeHtml(42)).toBe("42");
  });
  it("escapeMultiline keeps line breaks without allowing tags", () => {
    expect(escapeMultiline("a\n<b>")).toBe("a<br>&lt;b&gt;");
  });
  it("safeHeader strips CR/LF and caps length", () => {
    expect(safeHeader("Hi\r\nBcc: x@y.z")).toBe("Hi Bcc: x@y.z");
    expect(safeHeader("x".repeat(500)).length).toBe(200);
  });
});

describe("authorizeMail", () => {
  const order = { id: "ESO-1", userId: "u1", contactEmail: "Owner@Example.com" };
  const customer: MailCaller = { kind: "user", userId: "u1", email: "owner@example.com", isStaff: false };
  const stranger: MailCaller = { kind: "user", userId: "u2", email: "x@example.com", isStaff: false };
  const staff: MailCaller = { kind: "user", userId: "s1", email: "staff@es.com", isStaff: true };

  it("rejects anonymous callers", () => {
    expect(authorizeMail({ caller: { kind: "anonymous" }, kind: "placed", order })).toMatchObject({ ok: false, status: 401 });
  });

  it("lets the internal caller mail the order's own customer", () => {
    expect(authorizeMail({ caller: { kind: "internal" }, kind: "paid", order })).toEqual({ ok: true, to: "owner@example.com" });
  });

  it("lets staff send any kind", () => {
    expect(authorizeMail({ caller: staff, kind: "tracking", order })).toEqual({ ok: true, to: "owner@example.com" });
    expect(authorizeMail({ caller: staff, kind: "ticket", order: null, requestedTo: "cust@example.com" })).toEqual({
      ok: true,
      to: "cust@example.com",
    });
  });

  it("lets a customer send the 'placed' receipt for their own order to themselves", () => {
    expect(authorizeMail({ caller: customer, kind: "placed", order })).toEqual({ ok: true, to: "owner@example.com" });
  });

  it("stops a customer from choosing an arbitrary recipient", () => {
    expect(authorizeMail({ caller: customer, kind: "placed", order, requestedTo: "victim@example.com" })).toMatchObject({
      ok: false,
      status: 403,
    });
  });

  it("stops a customer mailing about someone else's order", () => {
    expect(authorizeMail({ caller: stranger, kind: "placed", order })).toMatchObject({ ok: false, status: 403 });
  });

  it("stops customers sending staff-only kinds", () => {
    for (const kind of ["paid", "tracking", "refund", "ticket"] as const) {
      expect(authorizeMail({ caller: customer, kind, order })).toMatchObject({ ok: false, status: 403 });
    }
  });

  it("requires an order for non-ticket mail and a valid address", () => {
    expect(authorizeMail({ caller: staff, kind: "paid", order: null })).toMatchObject({ ok: false, status: 404 });
    expect(authorizeMail({ caller: staff, kind: "ticket", order: null, requestedTo: "not-an-email" })).toMatchObject({ ok: false });
  });

  it("rejects unknown kinds", () => {
    // @ts-expect-error deliberately invalid
    expect(authorizeMail({ caller: staff, kind: "spam", order })).toMatchObject({ ok: false, status: 400 });
  });
});

describe("site URL + checkout return URLs", () => {
  it("only accepts https (or http on localhost) and normalises to an origin", () => {
    expect(resolveSiteUrl("https://staging.example.com/some/path")).toBe("https://staging.example.com");
    expect(resolveSiteUrl("http://localhost:5173")).toBe("http://localhost:5173");
    expect(resolveSiteUrl("http://evil.example.com")).toBe(DEFAULT_SITE_URL);
    expect(resolveSiteUrl("javascript:alert(1)")).toBe(DEFAULT_SITE_URL);
    expect(resolveSiteUrl("")).toBe(DEFAULT_SITE_URL);
  });

  it("builds Stripe return URLs on our own host with encoded params", () => {
    const u = checkoutReturnUrls("https://www.everythingsimulated.com.au", "ESO-1&x=1", "a+b@example.com");
    expect(u.success).toBe("https://www.everythingsimulated.com.au/order?id=ESO-1%26x%3D1&email=a%2Bb%40example.com&paid=1");
    expect(new URL(u.cancel).host).toBe("www.everythingsimulated.com.au");
  });
});

describe("CORS allowlist", () => {
  const allowed = allowedOrigins("https://www.everythingsimulated.com.au", "https://staging.example.com, http://localhost:5173, junk");

  it("contains SITE_URL and the extra origins only", () => {
    expect([...allowed].sort()).toEqual(["http://localhost:5173", "https://staging.example.com", "https://www.everythingsimulated.com.au"]);
  });

  it("echoes allowed origins and omits the header for others", () => {
    expect(corsHeadersFor("https://staging.example.com", allowed)["Access-Control-Allow-Origin"]).toBe("https://staging.example.com");
    expect(corsHeadersFor("https://evil.example.com", allowed)["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  const handler = withCors(
    () => new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } }),
    () => allowed,
  );

  it("answers allowed preflights with 204 and blocks others with 403", async () => {
    const ok = await handler(new Request("https://fn.local", { method: "OPTIONS", headers: { Origin: "https://staging.example.com" } }));
    expect(ok.status).toBe(204);
    expect(ok.headers.get("Access-Control-Allow-Origin")).toBe("https://staging.example.com");
    const bad = await handler(new Request("https://fn.local", { method: "OPTIONS", headers: { Origin: "https://evil.example.com" } }));
    expect(bad.status).toBe(403);
  });

  it("refuses browser requests from other origins before the handler runs", async () => {
    const res = await handler(new Request("https://fn.local", { method: "POST", headers: { Origin: "https://evil.example.com" } }));
    expect(res.status).toBe(403);
  });

  it("replaces any wildcard the handler set, and lets server-to-server calls through", async () => {
    const browser = await handler(new Request("https://fn.local", { method: "POST", headers: { Origin: "https://www.everythingsimulated.com.au" } }));
    expect(browser.headers.get("Access-Control-Allow-Origin")).toBe("https://www.everythingsimulated.com.au");
    const server = await handler(new Request("https://fn.local", { method: "POST" }));
    expect(server.status).toBe(200);
    expect(server.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
