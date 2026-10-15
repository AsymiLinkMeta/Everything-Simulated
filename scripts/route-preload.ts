import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

/**
 * Pages are lazy chunks, so the browser only learns which chunk it needs after the main
 * bundle has run. This plugin reads the route table in src/App.tsx, finds each page's
 * chunk (plus its lazy-only imports) in the build output, and inlines a small script in
 * index.html that adds <link rel="modulepreload"> for the current URL's page up front.
 */
export function routePatterns(appSource: string): { pattern: string; module: string }[] {
  const modules = new Map<string, string>();
  for (const m of appSource.matchAll(/const (\w+) = lazyRoute\(\(\) => import\("@\/([^"]+)"\)\)/g)) modules.set(m[1], m[2]);
  const out: { pattern: string; module: string }[] = [];
  for (const m of appSource.matchAll(/<Route path="(\/[^"]*)" element=\{<Page C=\{(\w+)\} \/>\}/g)) {
    const mod = modules.get(m[2]);
    if (mod) out.push({ pattern: m[1], module: mod });
  }
  return out;
}

export function patternToRegex(pattern: string): string {
  const body = pattern
    .split("/")
    .map((seg) => (seg.startsWith(":") ? "[^/]+" : seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    .join("/");
  return `^${body}/?$`;
}

export function routePreload(root: string): Plugin {
  return {
    name: "es-route-preload",
    apply: "build",
    enforce: "post",
    generateBundle(_opts, bundle) {
      const html = bundle["index.html"];
      if (!html || html.type !== "asset") return;
      const app = fs.readFileSync(path.join(root, "src/App.tsx"), "utf8");
      const chunks = Object.values(bundle).filter((c) => c.type === "chunk");
      const entry = chunks.find((c) => c.isEntry);
      if (!entry) return;
      // Everything the entry already loads eagerly needs no hint.
      const eager = new Set<string>();
      const walk = (name: string) => {
        if (eager.has(name)) return;
        eager.add(name);
        const c = bundle[name];
        if (c?.type === "chunk") c.imports.forEach(walk);
      };
      walk(entry.fileName);
      const table: [string, string[]][] = [];
      for (const { pattern, module } of routePatterns(app)) {
        const base = path.join(root, "src", module);
        const chunk = chunks.find((c) => c.facadeModuleId && [".tsx", ".ts"].some((ext) => c.facadeModuleId === base + ext));
        if (!chunk) continue;
        const files = new Set<string>();
        const add = (name: string) => {
          if (eager.has(name) || files.has(name)) return;
          files.add(name);
          const c = bundle[name];
          if (c?.type === "chunk") c.imports.forEach(add);
        };
        add(chunk.fileName);
        if (files.size) table.push([patternToRegex(pattern), [...files]]);
      }
      const script =
        `<script>(function(){var t=${JSON.stringify(table)};var p=location.pathname;` +
        `for(var i=0;i<t.length;i++){if(new RegExp(t[i][0]).test(p)){t[i][1].forEach(function(f){` +
        `var l=document.createElement("link");l.rel="modulepreload";l.href="/"+f;document.head.appendChild(l);});return;}}})();</script>`;
      const src = String(html.source);
      html.source = src.replace("</head>", `    ${script}\n  </head>`);
    },
  };
}
