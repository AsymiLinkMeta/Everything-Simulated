// Screenshots of the ghost-and-light-up rig preview for review (not a test). Needs the dev server on :5173.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
const base = "http://localhost:5173/build";
const out = "/workspace/Everything-Simulated/e2e/.shots/ghost";
mkdirSync(out, { recursive: true });
const couple = "tr120s,touring-seat,alpha-15";
const b = await chromium.launch();
for (const [vw, vh, tag] of [[390, 844, "390"], [1440, 900, "1440"]]) {
  const ctx = await b.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: tag === "390" ? 2 : 1 });
  await ctx.addInitScript(() => { localStorage.clear(); localStorage.setItem("es-cookie-ack", "1"); });
  const p = await ctx.newPage();
  const fig = p.getByTestId("rig-preview");
  const loaded = () => p.waitForFunction(() => [...document.querySelectorAll('[data-testid="rig-preview"] img')].every((i) => i.complete && i.naturalWidth > 0 && (!i.classList.contains("es-rp-lit") || i.dataset.loaded)));
  const shot = async (name, { settle = 2200, page = true } = {}) => {
    await fig.scrollIntoViewIfNeeded();
    await loaded();
    if (settle) await p.waitForTimeout(settle);
    if (page) await p.screenshot({ path: `${out}/${name}-${tag}.png` });
    await hideBar();
    await fig.screenshot({ path: `${out}/${name}-${tag}-preview.png` });
  };
  // the sticky total bar and any toast are page chrome, not the preview: keep them out of the panel shots
  const hideBar = () => p.addStyleTag({ content: ".es-rb-total,[data-sonner-toaster]{visibility:hidden !important}" });
  const go = async (q) => { await p.goto(base + q); await p.waitForLoadState("networkidle"); };

  await go(""); await shot("1-empty");
  await go(`?b=${couple}`); await shot("2-parts-added");
  // mid-add: pick a wheel and catch the red pulse
  await go(`?b=${couple}&step=wheel`);
  await loaded(); await p.waitForTimeout(1300);
  const card = p.getByTestId("builder-card-gt-neo");
  if (tag === "1440") { await card.hover(); await p.waitForTimeout(700); await shot("3a-hover-wheel", { settle: 0 }); }
  await card.getByRole("button", { name: "Choose" }).click();
  await p.waitForFunction(() => document.querySelector('[data-testid="rig-preview"] [data-part="wheel"] img.es-rp-lit')?.dataset.loaded);
  // hold the pulse at its peak (~0.4 s in) so the capture does not depend on timing
  await fig.scrollIntoViewIfNeeded();
  await p.evaluate(() => document.getAnimations().filter((a) => a.animationName === "es-rp-pulse").forEach((a) => { a.pause(); a.currentTime = 420; }));
  await p.screenshot({ path: `${out}/3-mid-add-glow-${tag}.png` });
  await hideBar();
  await fig.screenshot({ path: `${out}/3-mid-add-glow-${tag}-preview.png` });
  await go(""); await p.getByRole("button", { name: /Starter Rig/ }).first().click(); await p.waitForTimeout(500);
  await p.mouse.move(0, 0); await shot("4-starter");
  await go("?b=xr1,sr2,alpha-15,gt-neo,p1000-haptic,touring-seat,quad-mount,aoc-32*4,pc-race"); await shot("5-triple-top-motion");
  await ctx.close();
}
await b.close();
console.log("ok");
