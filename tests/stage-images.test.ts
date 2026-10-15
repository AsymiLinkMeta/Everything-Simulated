import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { STAGE_IMAGES, stagePreloadScript } from "../src/lib/es/stage-images";

describe("stage image preload", () => {
  it("maps each page to an existing WebP set", () => {
    for (const src of Object.values(STAGE_IMAGES)) {
      const name = src.replace(/^\/rigs\//, "").replace(/\.jpg$/, "");
      for (const w of [640, 1024, 1600]) expect(fs.existsSync(`public/rigs/${name}-${w}.webp`), `${name}-${w}.webp`).toBe(true);
    }
  });
  it("builds a script that preloads the current page's photo", () => {
    const script = stagePreloadScript();
    expect(script).toContain('"/shop":"starter"');
    const head = { appended: [] as Record<string, string>[] };
    const fakeLink = () => {
      const attrs: Record<string, string> = {};
      return Object.assign(attrs, { setAttribute: (k: string, v: string) => { attrs[k] = v; } });
    };
    const run = (pathname: string) => {
      head.appended = [];
      new Function("location", "document", script)({ pathname }, {
        createElement: fakeLink,
        head: { appendChild: (l: Record<string, string>) => head.appended.push(l) },
      });
      return head.appended[0];
    };
    expect(run("/shop/")?.imagesrcset).toBe("/rigs/starter-640.webp 640w, /rigs/starter-1024.webp 1024w, /rigs/starter-1600.webp 1600w");
    expect(run("/")?.imagesrcset).toContain("hero-poster-1024.webp");
    expect(run("/shop/alpha-15")).toBeUndefined();
  });
});
