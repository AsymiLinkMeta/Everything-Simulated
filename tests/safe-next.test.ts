import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/auth/safe-next";

describe("safeNext (post-login redirect)", () => {
  it.each(["/app", "/app/orders", "/staff/oms/ESO-1", "/checkout", "/order?id=ESO-1&email=a%40b.com", "/app#chat"])(
    "keeps same-site portal path %s",
    (p) => expect(safeNext(p, false)).toBe(p),
  );

  it.each([
    "https://evil.example.com",
    "//evil.example.com",
    "/\\evil.example.com",
    "/app\\@evil.example.com",
    "/%2F%2Fevil.example.com",
    "/app%2F..%2F..",
    "/appevil",
    "/",
    "/racing",
    "javascript:alert(1)",
    " /app",
    "",
    null,
  ])("rejects %s", (p) => expect(safeNext(p as string | null, false)).toBe("/app"));

  it("always sends the staff portal login to /staff", () => {
    expect(safeNext("/app/orders", true)).toBe("/staff");
  });
});
