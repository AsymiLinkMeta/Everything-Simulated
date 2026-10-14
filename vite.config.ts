import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

/** Host baked into index.html and public/*.txt|xml. VITE_SITE_URL rewrites it per environment. */
export const DEFAULT_SITE_ORIGIN = "https://www.everythingsimulated.com.au";
const HOST_FILES = ["sitemap.xml", "robots.txt", "llms.txt"];

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
    plugins: [react(), siteHost(origin, noindex)],
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
