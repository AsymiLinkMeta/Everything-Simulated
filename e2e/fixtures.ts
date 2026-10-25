import { test as base, expect, type Page, type ConsoleMessage, type APIRequestContext } from "@playwright/test";

export const API = process.env.LOCAL_API_URL ?? "http://localhost:54321";
export const PASSWORD = "Passw0rd!local";
export const ROLES = ["admin", "staff", "customer", "driver"] as const;
export type Role = (typeof ROLES)[number];
export const authFile = (role: Role) => `e2e/.auth/${role}.json`;

type Problems = { console: string[]; page: string[]; network: string[] };

/** Cookie consent record the app reads (src/lib/es/consent.ts). */
export const CONSENT_KEY = "es-consent";
export type ConsentChoice = "accept" | "reject" | null;

/**
 * Collects console errors, uncaught exceptions and failed same-origin/API requests.
 * `consent` presets the visitor's cookie choice for the default context (accept, so the
 * banner stays out of the way of other flows); consent.spec.ts sets it to null.
 */
export const test = base.extend<{ problems: Problems; consent: ConsentChoice }>({
  consent: ["accept", { option: true }],
  context: async ({ context, consent }, use) => {
    if (consent) {
      await context.addInitScript(
        ([key, referral]) => {
          try {
            if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ v: 1, referral, ts: new Date().toISOString() }));
          } catch {
            /* about:blank and opaque origins have no storage */
          }
        },
        [CONSENT_KEY, consent === "accept"] as const,
      );
    }
    await use(context);
  },
  problems: async ({ page }, use) => {
    const p: Problems = { console: [], page: [], network: [] };
    page.on("console", (m: ConsoleMessage) => {
      if (m.type() === "error") p.console.push(m.text().slice(0, 300));
    });
    page.on("pageerror", (e) => p.page.push(String(e).slice(0, 300)));
    page.on("response", (r) => {
      const u = r.url();
      if (r.status() >= 400 && (u.startsWith(API) || u.includes("localhost:5173"))) {
        p.network.push(`${r.status()} ${r.request().method()} ${u.replace(API, "API").slice(0, 200)}`);
      }
    });
    await use(p);
  },
});
export { expect };

export async function login(page: Page, role: Role) {
  const staff = role === "admin" || role === "staff";
  await page.goto(staff ? "/login?portal=staff" : "/login");
  await page.getByPlaceholder("Email").fill(`${role}@es.local`);
  await page.getByPlaceholder("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: staff ? "Login" : "Sign In", exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15_000 });
}

export const ANON_KEY = process.env.LOCAL_ANON_KEY ?? "";

/** REST headers for a demo account (or anon when role is omitted). */
export async function tokenHeaders(request: APIRequestContext, role?: Role) {
  const h: Record<string, string> = { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, "content-type": "application/json" };
  if (!role) return h;
  const tok = await request.post(`${API}/auth/v1/token?grant_type=password`, {
    data: { email: `${role}@es.local`, password: PASSWORD },
    headers: { apikey: ANON_KEY },
  });
  const { access_token } = (await tok.json()) as { access_token: string };
  return { ...h, Authorization: `Bearer ${access_token}` };
}
