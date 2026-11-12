import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { STAGE_IMAGES, STAGE_IMAGES_MOBILE, stagePreloadScript } from "../src/lib/es/stage-images";

describe("stage image preload", () => {
  it("maps each page to an existing WebP set", () => {
    for (const src of [...Object.values(STAGE_IMAGES), ...Object.values(STAGE_IMAGES_MOBILE)]) {
      const name = src!.replace(/^\/rigs\//, "").replace(/\.jpg$/, "");
      expect(fs.existsSync(`public/rigs/${name}.jpg`), `${name}.jpg`).toBe(true);
      for (const w of [640, 1024, 1600]) expect(fs.existsSync(`public/rigs/${name}-${w}.webp`), `${name}-${w}.webp`).toBe(true);
    }
  });
  it("uses Everything Simulated studio renders only", () => {
    for (const src of [...Object.values(STAGE_IMAGES), ...Object.values(STAGE_IMAGES_MOBILE)]) expect(src).toMatch(/^\/rigs\/es-/);
  });
  it("builds a script that preloads the current page's photo, art-directed on phones", () => {
    const script = stagePreloadScript();
    expect(script).toContain('"/racing":"es-cat-motion"');
    const head = { appended: [] as Record<string, string>[] };
    const fakeLink = () => {
      const attrs: Record<string, string> = {};
      return Object.assign(attrs, { setAttribute: (k: string, v: string) => { attrs[k] = v; } });
    };
    const run = (pathname: string, phone = false) => {
      head.appended = [];
      new Function("location", "document", "matchMedia", script)(
        { pathname },
        { createElement: fakeLink, head: { appendChild: (l: Record<string, string>) => head.appended.push(l) } },
        () => ({ matches: phone }),
      );
      return head.appended[0];
    };
    expect(run("/racing/")?.imagesrcset).toBe(
      "/rigs/es-cat-motion-640.webp 640w, /rigs/es-cat-motion-1024.webp 1024w, /rigs/es-cat-motion-1600.webp 1600w",
    );
    expect(run("/")?.imagesrcset).toContain("es-hero-wide-1024.webp");
    expect(run("/", true)?.imagesrcset).toContain("es-hero-tall-1024.webp");
    // Text-first and tool pages don't preload art.
    expect(run("/shop")).toBeUndefined();
    expect(run("/privacy")).toBeUndefined();
    expect(run("/shop/alpha-15")).toBeUndefined();
  });
});
