import { readEnv } from "./env.ts";
import { resolveSiteUrl } from "./site.ts";

const ALLOW_HEADERS = "Content-Type, Authorization, X-Client-Info, Apikey, X-Internal-Secret";

/**
 * Allowed browser origins: SITE_URL plus a comma-separated ALLOWED_ORIGINS list
 * (staging, deploy previews, http://localhost:5173 for dev). Wildcards are not supported.
 */
export function allowedOrigins(siteUrl = readEnv("SITE_URL"), extra = readEnv("ALLOWED_ORIGINS")): Set<string> {
  const set = new Set<string>([resolveSiteUrl(siteUrl)]);
  for (const raw of extra.split(",")) {
    const v = raw.trim();
    if (!v) continue;
    try {
      set.add(new URL(v).origin);
    } catch {
      // ignore malformed entries
    }
  }
  return set;
}

export function corsHeadersFor(origin: string | null, allowed: Set<string>): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": ALLOW_HEADERS,
    Vary: "Origin",
  };
  if (origin && allowed.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

type Handler = (req: Request) => Response | Promise<Response>;

/**
 * Wrap an edge-function handler with allowlisted CORS.
 * - Preflight from an allowed origin: 204 with CORS headers. Otherwise 403.
 * - Browser request from a disallowed origin: 403 before the handler runs.
 * - Requests without an Origin header (server-to-server, Stripe, curl) pass through.
 * Any Access-Control-Allow-Origin the handler set is replaced.
 */
export function withCors(handler: Handler, getAllowed: () => Set<string> = () => allowedOrigins()): Handler {
  return async (req: Request) => {
    const origin = req.headers.get("Origin");
    const allowed = getAllowed();
    const cors = corsHeadersFor(origin, allowed);
    const permitted = !origin || allowed.has(origin);
    if (req.method === "OPTIONS") {
      return new Response(null, { status: permitted ? 204 : 403, headers: cors });
    }
    if (!permitted) {
      return new Response(JSON.stringify({ error: "Origin not allowed" }), {
        status: 403,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const res = await handler(req);
    const headers = new Headers(res.headers);
    headers.delete("Access-Control-Allow-Origin");
    for (const [k, v] of Object.entries(cors)) headers.set(k, v);
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  };
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}
