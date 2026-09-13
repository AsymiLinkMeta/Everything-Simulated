import type { CartLine, CityPage, CompatibilityRule, Guide, PackageSpec } from "./types";
import { getCachedProductMap } from "./product-cache";

export const BRAND = {
  name: "Everything Simulated",
  contactName: "Taylah",
  phone: "0404 619 056",
  email: "hello@everythingsimulated.com.au",
  region: "Gold Coast, Queensland",
  shipping: "Australia-wide crate freight and optional install",
};

export const RULES: CompatibilityRule[] = [
  {
    id: "qr-neo",
    left: "gt-neo",
    right: "alpha-evo-12",
    severity: "allow",
    reason: "Simagic QR matches Alpha EVO.",
  },
  {
    id: "qr-neo-15",
    left: "gt-neo",
    right: "alpha-15",
    severity: "allow",
    reason: "Simagic QR matches Alpha 15Nm.",
  },
  {
    id: "sr2-tr120",
    left: "sr2",
    right: "tr120s",
    severity: "block",
    reason: "SR2 is not rated on the TR120S deck. Upgrade to Exodus XR1.",
  },
  {
    id: "sr2-xr1",
    left: "sr2",
    right: "xr1",
    severity: "allow",
    reason: "XR1 is motion-ready within SR2 payload.",
  },
  {
    id: "hyd-tr120",
    left: "p1000-haptic",
    right: "tr120s",
    severity: "warn",
    reason: "Hydraulic P1000 needs the heavy pedal tray on TR120S.",
  },
  {
    id: "alpha-tr120",
    left: "alpha-evo-12",
    right: "tr120s",
    severity: "adapter",
    reason: "Alpha EVO on TR120S needs the Simagic side-mount kit.",
    adapterSku: "side-mount",
  },
  {
    id: "alpha15-tr120",
    left: "alpha-15",
    right: "tr120s",
    severity: "warn",
    reason: "15Nm is at the TR120S torque ceiling. XR1 is the stiffer home.",
  },
  {
    id: "quad-tr120",
    left: "quad-mount",
    right: "tr120s",
    severity: "block",
    reason: "Four-screen frame is specified on Exodus XR1 only.",
  },
];

function linesTotal(lines: CartLine[]) {
  const map = getCachedProductMap();
  return lines.reduce((sum, l) => sum + (map[l.sku]?.sellExGst ?? 0) * l.qty, 0);
}

const starterLines: CartLine[] = [
  { sku: "tr120s", qty: 1 },
  { sku: "alpha-evo-12", qty: 1 },
  { sku: "gt-neo", qty: 1 },
  { sku: "p1000", qty: 1 },
  { sku: "seq-shifter", qty: 1 },
  { sku: "handbrake", qty: 1 },
  { sku: "pc-race", qty: 1 },
  { sku: "aoc-32", qty: 3 },
  { sku: "logi-surround", qty: 1 },
  { sku: "side-mount", qty: 1 },
];

const hapticLines: CartLine[] = [
  { sku: "xr1", qty: 1 },
  { sku: "quad-mount", qty: 1 },
  { sku: "touring-seat", qty: 1 },
  { sku: "alpha-15", qty: 1 },
  { sku: "gt-neo", qty: 1 },
  { sku: "p1000-haptic", qty: 1 },
  { sku: "seq-shifter", qty: 1 },
  { sku: "aoc-32", qty: 3 },
  { sku: "aux-27", qty: 1 },
  { sku: "logi-surround", qty: 1 },
  { sku: "pro-x", qty: 1 },
  { sku: "iracing-12", qty: 1 },
  { sku: "pc-race", qty: 1 },
];

const motionLines: CartLine[] = [...hapticLines, { sku: "sr2", qty: 1 }];

export const PACKAGES: PackageSpec[] = [
  {
    slug: "starter",
    name: "Starter Rig",
    kicker: "Entry",
    priceExGst: 1126000,
    blurb: "A solid, reliable first serious setup for beginners and casual racers.",
    image: "/rigs/starter.jpg",
    lines: starterLines,
    highlights: ["Trak Racer TR120S V2", "Simagic Alpha EVO 12Nm", "Triple 32\" curved", "Race-optimised PC"],
  },
  {
    slug: "haptic",
    name: "Haptic Racing Simulator",
    kicker: "Most popular",
    priceExGst: 1899900,
    blurb: "Balanced immersive build for every level — hydraulic brake, haptics, four screens.",
    image: "/rigs/haptic.jpg",
    lines: hapticLines,
    highlights: ["Exodus XR1", "Simagic Alpha 15Nm", "P1000 hydraulic + haptics", "iRacing 12 months"],
    popular: true,
  },
  {
    slug: "motion",
    name: "Motion Racing Simulator",
    kicker: "Flagship",
    priceExGst: 2899900,
    blurb: "Closest thing to track performance — SR2 motion on the Exodus XR1 system.",
    image: "/rigs/motion.jpg",
    lines: motionLines,
    highlights: ["SIMRIG SR2 3-DOF", "Exodus XR1", "Quad screens", "White-glove crate freight"],
  },
];

export const packagePartsTotal = linesTotal;

export const GUIDES: Guide[] = [
  {
    slug: "how-much-does-a-racing-simulator-cost-australia",
    title: "How much a turn-key racing simulator costs in Australia (2026)",
    description:
      "Real GST-inclusive bands for DIY parts, assembled rigs, haptic builds and full motion — Gold Coast built, delivered Australia-wide.",
    body: [
      "A parts kit from an online shop is not a turn-key simulator. Expect $2,500–$7,500 for chassis plus wheel and pedals with no PC and no professional assembly.",
      "Everything Simulated Starter packages start at $11,260 + GST and arrive assembled, with a race PC and triples. Haptic systems sit near $18,999 + GST. Full motion is $28,999 + GST including the SIMRIG SR2 platform.",
      "Freight is crate-based Australia-wide. SEQ install is standard; capital-city white-glove is scheduled; regional is quoted. Lead time is typically 3–6 weeks from deposit.",
      "If you already own triples or a PC, we strip those lines from the quote rather than forcing a bundle.",
    ],
  },
  {
    slug: "motion-vs-haptic-vs-static",
    title: "Motion vs haptic vs static — which rig to buy",
    description: "Choose the right feedback layer for iRacing, coaching, juniors and room constraints.",
    body: [
      "Static (Starter) is the right first serious rig: consistent ergonomics, 12Nm direct drive, triples. It teaches muscle memory without a motion ceiling or power circuit.",
      "Haptic adds hydraulic brake and pedal/seat transducers. You feel lock-up and kerbs without the height, payload and crate of a motion platform. It is the most popular home build we ship.",
      "Motion (SR2) heaves, rolls and pitches. It needs Exodus XR1, a payload check (driver + seat + screens) and usually a dedicated room. Do not mount SR2 on TR120S.",
      "Juniors and tight rooms should start haptic-capable on XR1 even if motion is added later — the chassis is the expensive mistake to avoid.",
    ],
  },
  {
    slug: "simagic-ecosystem-australia",
    title: "Simagic ecosystem explained for Australian builds",
    description: "Wheelbases, GT NEO, P1000 hydraulics, QR and what we actually spec on Gold Coast builds.",
    body: [
      "We spec Simagic as the control ecosystem across every package: Alpha EVO 12Nm on Starter, Alpha 15Nm on Haptic and Motion, GT NEO wheel, P1000 pedals.",
      "QR is Simagic native. Mixing foreign rims needs an adapter we will not silently assume — the checker will warn.",
      "Hydraulic P1000 with haptics is indent stock. Plan 3–5 weeks. Firmware lives in SimPro Manager on the included Windows 11 Pro PC.",
      "We are a Simagic stockist assembling complete systems, not a parts catalogue. Compatibility is enforced in the build app before a deposit is taken.",
    ],
  },
  {
    slug: "sim-racing-for-junior-drivers",
    title: "Best sim racing setup for junior and karting drivers",
    description: "Adjustable seating, torque caps and coaching-ready triples for young drivers in Australia.",
    body: [
      "Junior builds use the same XR1 or TR120S geometry with seat sliders, lower torque if needed, and a coaching overlay on the aux screen.",
      "We keep force-feedback at 12Nm unless a coach asks for more. Pedals stay load-cell so braking is honest at smaller body weights.",
      "Book a Gold Coast demo so we can set pedal spacing and wheel height before the crate leaves.",
    ],
  },
  {
    slug: "triple-screen-vs-ultrawide-iracing",
    title: "Triple screen vs ultrawide vs 57-inch for iRacing",
    description: "FOV, CPU cost and mount limits on Exodus and Trak Racer chassis.",
    body: [
      "Our Haptic and Motion packages ship triple 32-inch 240Hz AOC panels plus a 27-inch aux. That FOV is what we coach on.",
      "A single 57-inch ultrawide is a valid Starter alternative if the room is narrow — tell the build chatbot and we drop two monitors.",
      "Four-screen mounts are Exodus-only. The checker blocks them on TR120S.",
    ],
  },
  {
    slug: "australia-wide-delivery-and-install",
    title: "What you get when we deliver a simulator Australia-wide",
    description: "Crate classes, Gold Coast build photos, capital-city install and regional freight.",
    body: [
      "Every rig is assembled and QA'd on the Gold Coast. You get workshop photos before the crate is sealed.",
      "Starter and Haptic usually travel as a single crate plus monitor cartons. Motion is a dedicated crate for the SR2 actuators.",
      "Optional on-site install: SEQ standard, Sydney / Melbourne / Brisbane / Perth / Adelaide / Canberra / Hobart / Darwin on a schedule, regional by quote.",
      "Warranty is handled in Australia. Firmware and iRacing keys sit in your customer account after delivery.",
    ],
  },
];

export const CITIES: CityPage[] = [
  { slug: "gold-coast", name: "Gold Coast", state: "QLD", note: "Home workshop and try-before-you-buy showroom. SEQ install is standard." },
  { slug: "brisbane", name: "Brisbane", state: "QLD", note: "Same-week demo at the Gold Coast, scheduled install across Greater Brisbane." },
  { slug: "sydney", name: "Sydney", state: "NSW", note: "Crate freight to metro Sydney with optional white-glove unbox and calibration." },
  { slug: "melbourne", name: "Melbourne", state: "VIC", note: "Crate to metro Melbourne. Motion installs are booked on a run, not overnight." },
  { slug: "perth", name: "Perth", state: "WA", note: "West-coast crate with longer transit. We pre-QA so you are not debugging USB on arrival." },
  { slug: "adelaide", name: "Adelaide", state: "SA", note: "Standard haptic crate. Motion booked with a calibration visit." },
  { slug: "canberra", name: "Canberra", state: "ACT", note: "Capital freight, scheduled install for government and home gym rooms." },
  { slug: "hobart", name: "Hobart", state: "TAS", note: "Bass Strait crate. We over-pack motion and screens." },
  { slug: "darwin", name: "Darwin", state: "NT", note: "Air-road combination freight. Humidity-safe packing on electronics." },
  { slug: "sunshine-coast", name: "Sunshine Coast", state: "QLD", note: "SEQ run from the Gold Coast workshop — fastest install outside the Coast." },
];

export function packageBySlug(slug: string) {
  return PACKAGES.find((p) => p.slug === slug);
}

export function guideBySlug(slug: string) {
  return GUIDES.find((g) => g.slug === slug);
}

export function cityBySlug(slug: string) {
  return CITIES.find((c) => c.slug === slug);
}
