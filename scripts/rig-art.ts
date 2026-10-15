/**
 * Generates src/components/es/rig-art.ts: the rig builder's default preview, a generic
 * aluminium-profile sim rig drawn as flat-shaded SVG from a small 3D model (mm, real-world
 * proportions after common 1350–1440 mm x 580–660 mm profile cockpits). No branded product.
 *
 *   npx esbuild scripts/rig-art.ts --bundle --platform=node --outfile=/tmp/rig-art.cjs && node /tmp/rig-art.cjs
 *
 * Axes: x forward (the driver faces +x), y to the driver's left, z up. z = 0 is the floor
 * under the frame; the motion platform sits below it (z < 0) and lifts the rig.
 */
import { writeFileSync } from "node:fs";

type V = [number, number, number];
type Mat = { base: string; amb?: number; dif?: number; spec?: number; shin?: number; fill?: string; glow?: number };
type Face = { pts: V[]; mat: Mat; part: string; bias: number; two?: boolean; decor?: Decor[] };
type Decor = { pts: V[]; stroke: string; width: number };

const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V, s: number): V => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V): V => mul(a, 1 / Math.hypot(...a));
const rad = (d: number) => (d * Math.PI) / 180;

// ---------- materials ----------
const M: Record<string, Mat> = {
  alu: { base: "#565c66", amb: 0.55, dif: 0.85, spec: 0.38, shin: 22 },
  aluLight: { base: "#7a8089", amb: 0.45, dif: 0.7, spec: 0.55, shin: 30 },
  steel: { base: "#565b63", amb: 0.5, dif: 0.7, spec: 0.3, shin: 16 },
  black: { base: "#24262b", amb: 0.55, dif: 0.6, spec: 0.22, shin: 14 },
  rubber: { base: "#16171a", amb: 0.6, dif: 0.4, spec: 0.05, shin: 6 },
  shell: { base: "#2b2d33", amb: 0.55, dif: 0.85, spec: 0.55, shin: 40 },
  fabric: { base: "#34363d", amb: 0.55, dif: 0.65, spec: 0.04, shin: 4 },
  red: { base: "#e10600", amb: 0.55, dif: 0.6, spec: 0.35, shin: 24 },
  redGlow: { base: "#ff1410", amb: 1, dif: 0, spec: 0, glow: 1 },
  screen: { base: "#0a0d13", fill: "url(#rp-screen)" },
  glass: { base: "#0b0c10", fill: "url(#rp-glass)" },
  motor: { base: "#3a3e46", amb: 0.5, dif: 0.75, spec: 0.6, shin: 34 },
};

// ---------- camera ----------
const TARGET: V = [820, 0, 430];
const AZ = rad(66); // from straight behind, swung to the driver's right
const EL = rad(22);
const DIST = 5200;
const CAM: V = add(TARGET, mul([-Math.cos(AZ) * Math.cos(EL), -Math.sin(AZ) * Math.cos(EL), Math.sin(EL)], DIST));
const FWD = norm(sub(TARGET, CAM));
const RIGHT = norm(cross(FWD, [0, 0, 1]));
const UP = cross(RIGHT, FWD);
const KEY = norm([-0.35, -0.75, 0.9]); // key light: above, from the camera side
const FILL = norm([0.9, 0.4, 0.2]); // cool fill from the front
const proj = (p: V) => {
  const d = sub(p, CAM);
  const z = dot(d, FWD);
  return [dot(d, RIGHT) / z, -dot(d, UP) / z, z] as const;
};

// ---------- shading ----------
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (c: number[]) => "#" + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
function shade(f: Face, n: V, center: V): string {
  const m = f.mat;
  if (m.fill) return m.fill;
  const base = hex(m.base);
  if (m.glow) return m.base;
  const view = norm(sub(CAM, center));
  const dif = Math.max(0, dot(n, KEY));
  const fil = Math.max(0, dot(n, FILL)) * 0.25;
  const h = norm(add(KEY, view));
  const spec = (m.spec ?? 0) * Math.pow(Math.max(0, dot(n, h)), m.shin ?? 10);
  const under = Math.max(0, -n[2]) * 0.18; // red bounce from the lit floor
  const k = (m.amb ?? 0.5) * 0.62 + (m.dif ?? 0.7) * dif + fil;
  const rgb = base.map((c, i) => c * k + 255 * spec * 0.9 + (i === 0 ? 225 * under * 0.35 : 0));
  return toHex(rgb);
}

// ---------- primitives ----------
const faces: Face[] = [];
let PART = "chassis";
let BIAS = 0;
function face(pts: V[], mat: Mat, opts: { two?: boolean; decor?: Decor[] } = {}) {
  faces.push({ pts, mat, part: PART, bias: BIAS, ...opts });
}
/** Oriented box from an origin corner and three edge vectors (right-handed for outward normals). */
function obox(o: V, a0: V, b0: V, c: V, mat: Mat, decor?: (f: number) => Decor[] | undefined) {
  const [a, b] = dot(cross(a0, b0), c) < 0 ? [b0, a0] : [a0, b0];
  const P = (i: number, j: number, k: number) => add(add(add(o, mul(a, i)), mul(b, j)), mul(c, k));
  const quads: [V, V, V, V][] = [
    [P(0, 0, 0), P(0, 1, 0), P(1, 1, 0), P(1, 0, 0)], // -c
    [P(0, 0, 1), P(1, 0, 1), P(1, 1, 1), P(0, 1, 1)], // +c
    [P(0, 0, 0), P(1, 0, 0), P(1, 0, 1), P(0, 0, 1)], // -b
    [P(0, 1, 0), P(0, 1, 1), P(1, 1, 1), P(1, 1, 0)], // +b
    [P(0, 0, 0), P(0, 0, 1), P(0, 1, 1), P(0, 1, 0)], // -a
    [P(1, 0, 0), P(1, 1, 0), P(1, 1, 1), P(1, 0, 1)], // +a
  ];
  quads.forEach((q, i) => face(q, mat, { decor: decor?.(i) }));
}
/** Axis-aligned box, split along its long axis so the painter's sort stays honest. */
function box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, mat: Mat, slots = false) {
  const dims = [x1 - x0, y1 - y0, z1 - z0];
  const long = dims.indexOf(Math.max(...dims));
  const n = Math.max(1, Math.ceil(dims[long] / 220));
  for (let s = 0; s < n; s++) {
    const lo = [x0, y0, z0];
    const hi = [x1, y1, z1];
    const a0 = lo[long] + (dims[long] * s) / n;
    const a1 = lo[long] + (dims[long] * (s + 1)) / n;
    lo[long] = a0;
    hi[long] = a1;
    const o: V = [lo[0], lo[1], lo[2]];
    const ex: V = [hi[0] - lo[0], 0, 0];
    const ey: V = [0, hi[1] - lo[1], 0];
    const ez: V = [0, 0, hi[2] - lo[2]];
    obox(o, ex, ey, ez, mat, slots ? (fi) => slotDecor(fi, lo, hi, long) : undefined);
  }
}
/** T-slot grooves: a dark line every 40 mm along a profile face, red on the outer side rails. */
function slotDecor(fi: number, lo: number[], hi: number[], long: number): Decor[] | undefined {
  const normalAxis = [2, 2, 1, 1, 0, 0][fi];
  if (normalAxis === long) return undefined;
  const at = fi % 2 === 0 ? lo[normalAxis] : hi[normalAxis];
  const other = [0, 1, 2].find((k) => k !== long && k !== normalAxis)!;
  const span = hi[other] - lo[other];
  const count = Math.max(1, Math.round(span / 40));
  const out: Decor[] = [];
  for (let i = 0; i < count; i++) {
    const t = lo[other] + (span * (i + 0.5)) / count;
    const p0 = [0, 0, 0];
    const p1 = [0, 0, 0];
    p0[normalAxis] = p1[normalAxis] = at;
    p0[other] = p1[other] = t;
    p0[long] = lo[long];
    p1[long] = hi[long];
    out.push({ pts: [p0 as V, p1 as V], stroke: SLOT_RED && normalAxis === 1 && i === Math.floor(count / 2) ? "#e10600" : "#0a0b0d", width: SLOT_RED && normalAxis === 1 && i === Math.floor(count / 2) ? 1.6 : 1.1 });
  }
  return out;
}
let SLOT_RED = false;
/** Cylinder between two points. */
function cyl(a: V, b: V, r: number, mat: Mat, n = 18, caps = true, capMat?: Mat) {
  const ax = norm(sub(b, a));
  const ref: V = Math.abs(ax[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const u = norm(cross(ax, ref));
  const v = cross(ax, u);
  const ring = (c: V) => Array.from({ length: n }, (_, i) => add(c, add(mul(u, r * Math.cos((2 * Math.PI * i) / n)), mul(v, r * Math.sin((2 * Math.PI * i) / n)))));
  const A = ring(a);
  const B = ring(b);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    face([A[i], A[j], B[j], B[i]], mat);
  }
  if (caps) {
    face([...A].reverse(), capMat ?? mat);
    face(B, capMat ?? mat);
  }
}
/** A polygon (in the plane spanned by u, v at origin o) extruded by w. */
function prism(o: V, u: V, v: V, w: V, poly: [number, number][], mat: Mat, sideMat?: Mat) {
  const at = (p: [number, number], off: V) => add(add(add(o, mul(u, p[0])), mul(v, p[1])), off);
  const bot = poly.map((p) => at(p, [0, 0, 0]));
  const top = poly.map((p) => at(p, w));
  // orientation: make the -w cap face -w
  const nrm = cross(sub(bot[1], bot[0]), sub(bot[2], bot[0]));
  const flip = dot(nrm, w) > 0;
  const B = flip ? [...bot].reverse() : bot;
  const T = flip ? [...top].reverse() : top;
  face(B, mat);
  face([...T].reverse(), mat);
  for (let i = 0; i < B.length; i++) {
    const j = (i + 1) % B.length;
    face([B[i], T[i], T[j], B[j]], sideMat ?? mat);
  }
}
/** Ring (torus) in the plane normal to ax. */
function torus(c: V, ax: V, R: number, r: number, mat: Mat, n = 44, m = 8, from = 0, to = 360) {
  const a = norm(ax);
  const ref: V = Math.abs(a[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const u = norm(cross(a, ref));
  const v = cross(a, u);
  const P = (i: number, j: number): V => {
    const t = rad(from + ((to - from) * i) / n);
    const s = (2 * Math.PI * j) / m;
    const dir = add(mul(u, Math.cos(t)), mul(v, Math.sin(t)));
    return add(c, add(mul(dir, R + r * Math.cos(s)), mul(a, r * Math.sin(s))));
  };
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) face([P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)], mat);
}

// =====================================================================================
// MODEL
// =====================================================================================
const RAIL_Y = 270; // side rail centre line (frame 580 mm wide)

// ---- chassis: 1400 mm long, 160 x 40 side rails, cross members, wheel uprights ----
PART = "chassis";
SLOT_RED = true;
for (const s of [1, -1]) {
  box(0, 1400, s * RAIL_Y - 20, s * RAIL_Y + 20, 22, 182, M.alu, true); // 160 x 40 rail on edge
  for (const x of [30, 1370]) cyl([x, s * RAIL_Y, 0], [x, s * RAIL_Y, 22], 22, M.rubber, 12); // levelling feet
}
SLOT_RED = false;
box(0, 40, -RAIL_Y + 20, RAIL_Y - 20, 22, 102, M.alu, true); // rear cross
box(1360, 1400, -RAIL_Y + 20, RAIL_Y - 20, 22, 102, M.alu, true); // front cross
for (const x of [250, 560]) box(x, x + 40, -RAIL_Y + 20, RAIL_Y - 20, 102, 182, M.alu, true); // seat cross members
// wheel uprights 120 x 40, on the rails, with corner gussets
const UP_X0 = 880;
const UP_X1 = 1000;
const UP_TOP = 740;
for (const s of [1, -1]) {
  box(UP_X0, UP_X1, s * RAIL_Y - 20, s * RAIL_Y + 20, 182, UP_TOP, M.alu, true);
  for (const [x, dir] of [[UP_X0, -1], [UP_X1, 1]] as const) {
    prism([x, s * RAIL_Y - 18, 182], [dir, 0, 0], [0, 0, 1], [0, 36, 0], [[0, 0], [110, 0], [0, 110]], M.aluLight);
  }
}
// wheel deck cross beam between the uprights
box(UP_X0 + 40, UP_X1, -RAIL_Y + 20, RAIL_Y - 20, 560, 640, M.alu, true);

// ---- motion platform (under the frame) ----
PART = "motion";
BIAS = -1e6;
const MH = 150;
for (const x of [60, 1340]) {
  for (const s of [1, -1]) {
    cyl([x, s * RAIL_Y, -MH], [x, s * RAIL_Y, -MH + 22], 78, M.black, 20);
    cyl([x, s * RAIL_Y, -MH + 22], [x, s * RAIL_Y, -18], 62, M.motor, 20);
    cyl([x, s * RAIL_Y, -40], [x, s * RAIL_Y, -26], 64, M.red, 20, false);
    cyl([x, s * RAIL_Y, -18], [x, s * RAIL_Y, 0], 36, M.aluLight, 14);
  }
}
box(560, 840, -110, 110, -MH, -MH + 70, M.black); // controller
BIAS = 0;

// ---- seat: bucket shell with bolsters, on a slider ----
PART = "seat";
box(200, 660, 150, 190, 182, 212, M.aluLight); // slider rails
box(200, 660, -190, -150, 182, 212, M.aluLight);
box(560, 600, -150, 150, 190, 205, M.aluLight); // slider bar
for (const s of [1, -1]) prism([280, s * 268, 205], [1, 0, 0], [0, 0, 1], [0, -s * 8, 0], [[0, 0], [260, 0], [230, 110], [20, 110]], M.steel);
// shell profile (side view) — outline of the side wings
const SEAT_OUT: [number, number][] = [
  [650, 250], [660, 345], [600, 372], [470, 352], [360, 332], [300, 330], [250, 430], [195, 600], [150, 760], [125, 840], [110, 880], [100, 960], [90, 1010],
  [40, 1018], [8, 990], [10, 900], [30, 760], [70, 560], [130, 330], [160, 238], [190, 220],
];
const SEAT_W = 270;
for (const s of [1, -1]) prism([0, s * SEAT_W, 0], [1, 0, 0], [0, 0, 1], [0, -s * 46, 0], SEAT_OUT, M.shell, M.shell);
// back shell: rounded across the width
const BACK: [number, number][] = [[190, 222], [160, 238], [130, 330], [70, 560], [30, 760], [10, 900], [8, 990], [40, 1018], [90, 1010]];
const PAN: [number, number][] = [[640, 318], [470, 300], [340, 280], [290, 290], [250, 400], [200, 570], [160, 740], [130, 860], [110, 990]];
const loft = (prof: [number, number][], bulge: number, mat: Mat, w = SEAT_W - 30, cols = 8) => {
  for (let i = 0; i < prof.length - 1; i++) {
    for (let j = 0; j < cols; j++) {
      const y0 = -w + (2 * w * j) / cols;
      const y1 = -w + (2 * w * (j + 1)) / cols;
      const pt = (p: [number, number], y: number): V => [p[0] - bulge * (1 - (y / w) ** 2), y, p[1]];
      face([pt(prof[i], y0), pt(prof[i + 1], y0), pt(prof[i + 1], y1), pt(prof[i], y1)], mat, { two: true });
    }
  }
};
loft(BACK, 34, M.shell, SEAT_W - 20);
loft(PAN, -26, M.fabric, SEAT_W - 46);
// red stitching along the top of each wing
for (const s of [1, -1]) {
  const edge = SEAT_OUT.slice(1, 12).map(([x, z]) => [x, s * (SEAT_W - 46) - s * 2, z + 2] as V);
  faces.push({ pts: edge, mat: M.red, part: "seat", bias: 4, decor: undefined, two: true });
}
// harness slots
for (const yy of [-75, 75]) {
  const c: V = [44, yy, 820];
  faces.push({ pts: [[c[0] - 4, yy - 22, 780], [c[0] - 10, yy - 22, 870], [c[0] - 10, yy + 22, 870], [c[0] - 4, yy + 22, 780]].map((p) => [p[0] - 34 * (1 - (p[1] / (SEAT_W - 20)) ** 2) - 2, p[1], p[2]] as V), mat: M.rubber, part: "seat", bias: 4, two: true });
  void c;
}

// ---- wheelbase on a front mount ----
PART = "wheelbase";
const TILT = rad(14);
const AX: V = [-Math.cos(TILT), 0, -Math.sin(TILT)]; // from the mount toward the driver
const PLATE: V = [UP_X0 + 30, 0, 690];
obox([UP_X0 + 30, -95, 560], [12, 0, 0], [0, 190, 0], [0, 0, 220], M.steel); // front mount plate
for (const s of [1, -1]) obox([UP_X0 + 42, s * 95 - (s > 0 ? 0 : 0), 560], [80, 0, 0], [0, s > 0 ? -10 : 10, 0], [0, 0, 160], M.steel); // gussets
const MB0 = add(PLATE, mul(AX, 0));
const MB1 = add(PLATE, mul(AX, 210));
obox(add(MB0, [0, -78, -78]), [-14, 0, 0], [0, 156, 0], [0, 0, 156], M.black); // flange
cyl(add(MB0, mul(AX, 14)), MB1, 72, M.motor, 22, true, M.black);
cyl(add(MB0, mul(AX, 150)), add(MB0, mul(AX, 162)), 74, M.red, 22, false);
cyl(MB1, add(MB1, mul(AX, 30)), 34, M.aluLight, 14);

// ---- wheel: 300 mm round rim, three spokes, hub with buttons ----
PART = "wheel";
const WC = add(MB1, mul(AX, 62));
cyl(add(MB1, mul(AX, 30)), WC, 28, M.black, 14);
torus(WC, AX, 150, 17, M.rubber, 32, 6);
const wu = norm(cross(AX, [0, 0, 1]));
const wv = cross(AX, wu);
cyl(add(WC, mul(AX, -6)), add(WC, mul(AX, 18)), 62, M.black, 22, true, M.steel);
for (const ang of [180, 0, 270]) {
  const d = add(mul(wu, Math.cos(rad(ang))), mul(wv, Math.sin(rad(ang))));
  const side = cross(AX, d);
  obox(add(add(WC, mul(d, 56)), mul(side, -18)), mul(d, 74), mul(side, 36), mul(AX, 10), M.aluLight);
}
for (const [a, rr] of [[30, 34], [150, 34], [90, 40]] as const) {
  const d = add(mul(wu, Math.cos(rad(a))), mul(wv, Math.sin(rad(a))));
  const p = add(add(WC, mul(d, rr)), mul(AX, 19));
  cyl(p, add(p, mul(AX, 5)), 8, M.red, 10);
}
torus(WC, AX, 150, 17.5, M.red, 6, 6, 264, 276); // top-dead-centre stripe

// ---- pedal deck with three pedals ----
PART = "pedals";
const PA = rad(38);
const PU: V = [Math.cos(PA), 0, Math.sin(PA)]; // up the deck (toward the front)
const PN: V = [-Math.sin(PA), 0, Math.cos(PA)]; // deck normal (toward the driver)
const P0: V = [1100, -225, 190];
obox(P0, mul(PU, 330), [0, 450, 0], mul(PN, -8), M.steel);
box(1070, 1110, -RAIL_Y + 20, RAIL_Y - 20, 142, 182, M.alu, true); // deck cross bar
for (const s of [1, -1]) box(1320, 1350, s * 150 - 15, s * 150 + 15, 182, 380, M.alu); // deck rear posts
const pedal = (y: number, arm: number, red: boolean) => {
  const base = add(add(P0, mul(PU, 50)), [0, y + 225, 0]);
  obox(add(base, [0, -30, 0]), mul(PU, 120), [0, 60, 0], mul(PN, 30), M.black);
  const pivot = add(add(base, mul(PU, 20)), mul(PN, 30));
  const tip = add(add(pivot, mul(PU, arm * 0.62)), mul(PN, arm * 0.78));
  const ad = norm(sub(tip, pivot));
  obox(add(pivot, [0, -10, 0]), sub(tip, pivot), [0, 20, 0], mul(cross(ad, [0, 1, 0]), 18), M.aluLight);
  obox(add(add(tip, mul(ad, -80)), [0, -40, 0]), mul(ad, 115), [0, 80, 0], mul(cross(ad, [0, -1, 0]), 12), M.aluLight);
  if (red) {
    const a = add(add(base, mul(PU, 110)), mul(PN, 30));
    const b = add(pivot, mul(ad, arm * 0.55));
    cyl(a, b, 16, M.red, 12);
  }
};
pedal(130, 230, false);
pedal(0, 230, true);
pedal(-125, 250, false);

// ---- side mount, shifter, handbrake (driver's right) ----
PART = "sidemount";
box(600, 640, -RAIL_Y - 120, -RAIL_Y - 20, 120, 160, M.alu, true);
box(600, 640, -RAIL_Y - 120, -RAIL_Y - 80, 160, 470, M.alu, true);
box(520, 700, -RAIL_Y - 140, -RAIL_Y - 60, 470, 482, M.steel);
PART = "shifter";
box(600, 690, -RAIL_Y - 128, -RAIL_Y - 72, 482, 540, M.black);
cyl([645, -RAIL_Y - 100, 540], [625, -RAIL_Y - 100, 690], 7, M.aluLight, 10);
cyl([622, -RAIL_Y - 100, 690], [619, -RAIL_Y - 100, 735], 22, M.black, 16);
cyl([621, -RAIL_Y - 100, 700], [621, -RAIL_Y - 100, 708], 23, M.red, 16, false);
PART = "handbrake";
box(525, 590, -RAIL_Y - 126, -RAIL_Y - 74, 482, 560, M.black);
cyl([560, -RAIL_Y - 100, 545], [470, -RAIL_Y - 100, 800], 9, M.aluLight, 10);
cyl([475, -RAIL_Y - 100, 785], [455, -RAIL_Y - 100, 860], 18, M.rubber, 14);
cyl([455, -RAIL_Y - 100, 860], [452, -RAIL_Y - 100, 872], 18, M.red, 14);

// ---- PC tower, on the floor beside the seat ----
PART = "pc";
const PCY = RAIL_Y + 90; // beside the frame, behind the seat, on the driver's left
box(-80, 380, PCY, PCY + 210, 0, 470, M.black);
faces.push({ pts: [[-81, PCY + 20, 40], [-81, PCY + 190, 40], [-81, PCY + 190, 440], [-81, PCY + 20, 440]], mat: M.glass, part: "pc", bias: 5 });
faces.push({ pts: [[-82, PCY + 20, 40], [-82, PCY + 190, 40], [-82, PCY + 190, 46], [-82, PCY + 20, 46]], mat: M.redGlow, part: "pc", bias: 6 });
torus([-83, PCY + 105, 330], [1, 0, 0], 62, 4, M.red, 24, 4);
torus([-83, PCY + 105, 160], [1, 0, 0], 62, 4, M.red, 24, 4);

// ---- display stand (free-standing, four-screen capable) and screens ----
const SX = 1760; // centre screen plane
const SB = 820; // screen bottom
const SW = 720; // 32-inch panel, bezel included
const SCR_H = 420;
const SIDE = rad(58);
PART = "mount";
for (const s of [1, -1]) {
  box(1520, 1980, s * 300 - 20, s * 300 + 20, 0, 40, M.alu, true);
  box(SX + 40, SX + 80, s * 300 - 20, s * 300 + 20, 40, 1270, M.alu, true);
}
box(SX + 40, SX + 80, -380, 380, 980, 1020, M.alu, true);
box(SX + 40, SX + 80, -320, 320, 40, 80, M.alu, true);
PART = "mount-top";
for (const s of [1, -1]) box(SX + 40, SX + 80, s * 300 - 20, s * 300 + 20, 1270, 1690, M.alu, true);
box(SX + 40, SX + 80, -320, 320, 1590, 1630, M.alu, true);
PART = "mount-sides";
for (const s of [1, -1]) {
  const hinge: V = [SX + 50, s * 380, 980];
  const dir: V = [-Math.sin(SIDE), s * Math.cos(SIDE), 0];
  obox(hinge, mul(dir, 520), [0, 0, 40], mul(cross(dir, [0, 0, 1]), s * 40), M.alu);
}
const monitor = (o: V, along: V, part: string, SH = SCR_H) => {
  PART = part;
  const facing = norm(cross(along, [0, 0, 1])); // toward the driver
  const back = mul(facing, -1);
  obox(o, along, [0, 0, SH], mul(back, 22), M.black);
  const scr = (k: number): V => add(add(o, mul(along, k)), mul(facing, 0.6));
  const in0 = add(scr(0.015), [0, 0, 14]);
  const w = mul(along, 0.97);
  faces.push({ pts: [in0, add(in0, w), add(add(in0, w), [0, 0, SH - 40]), add(in0, [0, 0, SH - 40])], mat: M.screen, part, bias: 5 });
  const mid = add(add(o, mul(along, 0.5)), add(mul(back, 22), [0, 0, SH * 0.5]));
  obox(add(mid, add(mul(along, -0.12), [0, 0, -70])), mul(along, 0.24), [0, 0, 140], mul(back, 40), M.black);
};
monitor([SX, SW / 2, SB], [0, -SW, 0], "screen-center");
for (const s of [1, -1]) {
  const dir: V = [-Math.sin(SIDE), s * Math.cos(SIDE), 0];
  const start: V = add([SX, s * (SW / 2 + 6), SB], [0, 0, 0]);
  const end = add(start, mul(dir, SW));
  if (s > 0) monitor(end, mul(dir, -SW), "screen-sides");
  else monitor(start, mul(dir, SW), "screen-sides");
}
monitor([SX, 300, 1262], [0, -600, 0], "screen-top", 350);

// ---- VR headset, resting on the headrest ----
PART = "headset";
box(60, 200, -95, 95, 1030, 1110, M.black);
box(198, 206, -88, 88, 1040, 1100, M.shell);
torus([95, 0, 1070], [0, 0, 1], 92, 7, M.rubber, 24, 5, 100, 260);
box(150, 160, -96, 96, 1060, 1066, M.red);

// =====================================================================================
// RENDER
// =====================================================================================
const VW = 800;
const VH = 560;
const visible = faces
  .map((f) => {
    const c = mul(f.pts.reduce((a, p) => add(a, p), [0, 0, 0] as V), 1 / f.pts.length);
    let n = norm(cross(sub(f.pts[1], f.pts[0]), sub(f.pts[2], f.pts[0])));
    const toCam = sub(CAM, c);
    if (dot(n, toCam) < 0) {
      if (!f.two) return null;
      n = mul(n, -1);
    }
    const depth = Math.hypot(...toCam);
    return { f, n, c, depth };
  })
  .filter((x): x is NonNullable<typeof x> => x !== null);

// fit the whole rig (every part, so the frame never jumps) into the view box
const all = visible.flatMap((v) => v.f.pts.map(proj));
const minX = Math.min(...all.map((p) => p[0]));
const maxX = Math.max(...all.map((p) => p[0]));
const minY = Math.min(...all.map((p) => p[1]));
const maxY = Math.max(...all.map((p) => p[1]));
const PAD = 22;
const S = Math.min((VW - 2 * PAD) / (maxX - minX), (VH - 2 * PAD) / (maxY - minY));
const OX = (VW - (maxX - minX) * S) / 2 - minX * S;
const OY = (VH - (maxY - minY) * S) / 2 - minY * S;
const to2 = (p: V) => {
  const q = proj(p);
  return [q[0] * S + OX, q[1] * S + OY] as const;
};
const fmt = (n: number) => Math.round(n).toString();
const path = (pts: V[], close = true) => pts.map((p, i) => `${i ? "L" : "M"}${fmt(to2(p)[0])} ${fmt(to2(p)[1])}`).join("") + (close ? "Z" : "");

visible.sort((a, b) => b.depth - b.f.bias * 1 - (a.depth - a.f.bias * 1));

type Group = { part: string; html: string };
const groups: Group[] = [];
for (const v of visible) {
  const fill = shade(v.f, v.n, v.c);
  const isLine = v.f.mat === M.red && v.f.pts.length > 4 && v.f.part === "seat" && v.f.bias === 4;
  let el = isLine
    ? `<path d="${path(v.f.pts, false)}" fill="none" stroke="#e10600" stroke-width="1.6" stroke-dasharray="3 2.5"/>`
    : `<path d="${path(v.f.pts)}" fill="${fill}" stroke="${fill.startsWith("url") ? "#05070a" : fill}" stroke-width="${fill.startsWith("url") ? 0.8 : 0.6}"/>`;
  for (const d of v.f.decor ?? []) el += `<path d="${path(d.pts, false)}" stroke="${d.stroke}" stroke-width="${d.width}" fill="none"/>`;
  const last = groups[groups.length - 1];
  if (last && last.part === v.f.part) last.html += el;
  else groups.push({ part: v.f.part, html: el });
}

// floor shadow under the frame at the motion-platform floor, and under the stand and the PC
const shadow = (pts: V[]) => path(pts);
const floorZ = -MH;
const shadowHtml =
  `<path d="${shadow([[-160, -RAIL_Y - 520, floorZ], [1500, -RAIL_Y - 520, floorZ], [2050, -420, floorZ], [2050, 420, floorZ], [1500, RAIL_Y + 140, floorZ], [-160, RAIL_Y + 140, floorZ]])}" fill="#000" opacity="0.62" filter="url(#rp-blur)"/>`;

// how far the rig drops (in view-box units) when there is no motion platform under it
const drop = to2([700, 0, -MH])[1] - to2([700, 0, 0])[1];

const out = `// Generated by scripts/rig-art.ts. Do not edit by hand; change the model there and re-run it.
export const RIG_VIEWBOX = "0 0 ${VW} ${VH}";
/** View-box units the rig sits lower when it has no motion platform under it. */
export const RIG_DROP = ${fmt(drop)};
export const RIG_SHADOW = ${JSON.stringify(shadowHtml)};
/** Painter-ordered groups, back to front. One part can appear in several groups. */
export const RIG_GROUPS: { part: string; html: string }[] = ${JSON.stringify(groups)};
`;
writeFileSync(new URL("../src/components/es/rig-art.ts", import.meta.url), out);
console.log(`faces ${visible.length}, groups ${groups.length}, bytes ${out.length}, drop ${fmt(drop)}`);
