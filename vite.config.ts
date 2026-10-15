import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EMPTY_CATALOG, fetchSeoCatalog, renderLlms, renderSitemap, type SeoCatalog } from "./scripts/seo-files";

const root = path.dirname(fileURLToPath(import.meta.url));

/** Host baked into index.html and public/*.txt|xml. VITE_SITE_URL rewrites it per environment. */
export const DEFAULT_SITE_ORIGIN = "https://www.everythingsimulated.com.au";
const HOST_FILES = ["robots.txt"];

function siteHost(origin: string, noindex: boolean): Plugin {
  let outDir = "dist";
  const swap = (text: string) => (origin === DEFAULT_SITE_ORIGIN ? text : text.split(DEFAULT_SITE_ORIGIN).join(origin));
  return {
    name: "es-site-host",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    transformIndexHtml(html) {
      let out = swap(html);
      if (noindex) out = out.replace(/<meta name="robots" content="[^"]*" \/>/, '<meta name="robots" content="noindex,nofollow" />');
      return out;
    },
    closeBundle() {
      for (const name of HOST_FILES) {
        const file = path.join(outDir, name);
        if (!fs.existsSync(file)) continue;
        fs.writeFileSync(file, swap(fs.readFileSync(file, "utf8")));
      }
      if (noindex) {
        // Staging / previews must never be indexed (duplicate content with production).
        fs.writeFileSync(path.join(outDir, "robots.txt"), "User-agent: *\nDisallow: /\n");
      }
    },
  };
}

/**
 * sitemap.xml and llms.txt are generated from Supabase (published rows, anon
 * key) at build time and served live by the dev server. Product, prebuild,
 * price and ambassador entries are never written by hand.
 *
 * If the database can't be reached the build fails when SEO_REQUIRE_DB=true
 * (set for Netlify production) and otherwise writes the static pages only.
 */
function seoFiles(origin: string, supabaseUrl: string | undefined, anonKey: string | undefined): Plugin {
  let outDir = "dist";
  let isBuild = false;
  const load = async (): Promise<{ data: SeoCatalog; error?: string }> => {
    if (!supabaseUrl || !anonKey) return { data: EMPTY_CATALOG, error: "VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set" };
    try {
      return { data: await fetchSeoCatalog(supabaseUrl, anonKey) };
    } catch (err) {
      return { data: EMPTY_CATALOG, error: err instanceof Error ? err.message : String(err) };
    }
  };
  return {
    name: "es-seo-files",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
      isBuild = config.command === "build";
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = (req.url ?? "").split("?")[0];
        if (url !== "/sitemap.xml" && url !== "/llms.txt") return next();
        const { data, error } = await load();
        if (error) server.config.logger.warn(`[es-seo-files] ${error}`);
        res.setHeader("Content-Type", url === "/sitemap.xml" ? "application/xml" : "text/plain; charset=utf-8");
        res.end(url === "/sitemap.xml" ? renderSitemap(origin, data) : renderLlms(origin, data));
      });
    },
    async closeBundle() {
      if (!isBuild) return;
      const { data, error } = await load();
      if (error) {
        if (process.env.SEO_REQUIRE_DB === "true") {
          throw new Error(`[es-seo-files] could not read the catalogue for sitemap.xml / llms.txt: ${error}`);
        }
        console.warn(`[es-seo-files] ${error}; writing sitemap.xml and llms.txt without catalogue entries`);
      }
      fs.writeFileSync(path.join(outDir, "sitemap.xml"), renderSitemap(origin, data));
      fs.writeFileSync(path.join(outDir, "llms.txt"), renderLlms(origin, data));
      console.log(
        `[es-seo-files] sitemap.xml + llms.txt: ${data.prebuilds.length} prebuilds, ${data.products.length} parts, ${data.ambassadors.length} ambassadors`,
      );
    },
  };
}

function normaliseOrigin(raw: string | undefined): string {
  if (!raw) return DEFAULT_SITE_ORIGIN;
  try {
    return new URL(raw).origin;
  } catch {
    throw new Error(`VITE_SITE_URL is not a valid URL: ${raw}`);
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, "VITE_");
  const origin = normaliseOrigin(env.VITE_SITE_URL);
  const noindex = env.VITE_NOINDEX === "true";
  return {
    plugins: [react(), siteHost(origin, noindex), seoFiles(origin, env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)],
    resolve: {
      alias: {
        "@": path.resolve(root, "src"),
        "@tanstack/react-router": path.resolve(root, "src/shims/tanstack-react-router.tsx"),
      },
    },
    server: { host: true, port: 5173 },
    build: {
      rollupOptions: {
        output: {
          // Long-lived vendor chunks: they change far less often than app code.
          manualChunks(id) {
            if (!id.includes("node_modules")) return undefined;
            if (id.includes("@supabase")) return "vendor-supabase";
            if (/node_modules\/(react|react-dom|scheduler|react-router|react-router-dom|@remix-run)\//.test(id)) return "vendor-react";
            if (id.includes("@tanstack")) return "vendor-query";
            return "vendor";
          },
        },
      },
    },
  };
});
