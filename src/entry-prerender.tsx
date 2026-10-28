/**
 * Build-time entry for scripts/prerender.mjs: renders each public page to static HTML
 * (lazy page chunks included) and returns the head tags its route asks for.
 */
import { Writable } from "node:stream";
import { renderToPipeableStream } from "react-dom/server";
import { StaticRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "@/lib/auth/provider";
import { AppProviders } from "@/components/es/providers";
import { takePrerenderHead } from "@/lib/prerender";
import { SITE_ORIGIN } from "@/lib/site";
import { CITIES, GUIDES } from "@/lib/es/content";
import { STATIC_ROUTES } from "../scripts/seo-files";

export const ORIGIN = SITE_ORIGIN;
export const NOT_FOUND_PATH = "/__not-found__";

/**
 * Catalogue listings render from the live database in the browser; at build time they
 * would show an empty list, so they get their own title, description and canonical
 * but no prerendered body.
 */
export const HEAD_ONLY_ROUTES = ["/prebuilds", "/shop"];

/** The sitemap's site-structure, guide and city URLs (catalogue pages stay client-rendered). */
export const PRERENDER_ROUTES: string[] = [
  ...STATIC_ROUTES.map((r) => r.path),
  ...GUIDES.map((g) => `/guides/${g.slug}`),
  ...CITIES.map((c) => `/au/${c.slug}`),
];

export function render(path: string): Promise<{ html: string; head: unknown }> {
  takePrerenderHead();
  return new Promise((resolve, reject) => {
    let html = "";
    const sink = new Writable({
      write(chunk, _enc, cb) {
        html += chunk.toString();
        cb();
      },
    });
    sink.on("finish", () => resolve({ html, head: takePrerenderHead() }));
    const stream = renderToPipeableStream(
      <StaticRouter location={path}>
        <AuthProvider>
          <AppProviders>
            <App />
          </AppProviders>
        </AuthProvider>
      </StaticRouter>,
      {
        onAllReady() {
          stream.pipe(sink);
        },
        onShellError: reject,
        onError(err) {
          reject(new Error(`[prerender] ${path}: ${err instanceof Error ? err.message : String(err)}`));
        },
      },
    );
  });
}
