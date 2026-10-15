import { chromium } from "@playwright/test";
const base = "http://localhost:5173/build";
const out = "/workspace/Everything-Simulated/e2e/.shots";
const core = "tr120s,alpha-15,gt-neo,p1000,touring-seat";
const builds = {
  empty: "",
  motion: `?b=xr1,sr2,alpha-15,gt-neo,p1000-haptic,touring-seat,quad-mount,aoc-32*3,seq-shifter,handbrake,pc-race`,
  single: `?b=${core},quad-mount,aoc-32`,
  dual: `?b=${core},quad-mount,aoc-32*2`,
  quad: `?b=${core},quad-mount,aoc-32*4,pc-race`,
  vr: `?b=${core},pro-x,pc-starter`,
};
const b = await chromium.launch();
for (const [vw, vh, tag] of [[390, 844, "390"], [1440, 900, "1440"]]) {
  const ctx = await b.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: tag === "390" ? 2 : 1 });
  await ctx.addInitScript(() => { localStorage.clear(); localStorage.setItem("es-cookie-ack", "1"); });
  const p = await ctx.newPage();
  const shot = async (name) => {
    const fig = p.getByTestId("rig-preview");
    await fig.scrollIntoViewIfNeeded();
    await p.waitForFunction(() => [...document.querySelectorAll('[data-testid="rig-preview"] img')].every((i) => i.complete && i.naturalWidth > 0));
    await p.waitForTimeout(900);
    await p.screenshot({ path: `${out}/${name}-${tag}.png` });
    await p.addStyleTag({ content: ".es-rb-total{visibility:hidden}" });
    await fig.screenshot({ path: `${out}/${name}-${tag}-preview.png` });
  };
  for (const [name, q] of Object.entries(builds)) {
    await p.goto(base + q); await p.waitForLoadState("networkidle");
    await shot(name);
  }
  await p.goto(base); await p.waitForLoadState("networkidle");
  await p.getByRole("button", { name: /Starter Rig/ }).first().click();
  await p.waitForTimeout(500);
  await shot("starter");
  await ctx.close();
}
await b.close();
console.log("ok");
