/**
 * Editorial site content: business details, buying guides and city pages.
 *
 * No product, prebuild, part, price, brand or compatibility data lives here;
 * that is all in Supabase. Guide copy that quotes a price uses a
 * {{price:<prebuild-slug>}} token, filled from the database at render time
 * (see live-copy.ts). This module has no imports so vite.config.ts can read
 * it when generating sitemap.xml and llms.txt.
 */
import type { CityPage, Guide } from "./types";

export const BRAND = {
  name: "Everything Simulated",
  phone: "0404 619 056",
  email: "hello@everythingsimulated.com.au",
  region: "Gold Coast, Queensland",
  shipping: "Australia-wide crate freight and optional install",
};

export const GUIDES: Guide[] = [
  {
    slug: "how-much-does-a-racing-simulator-cost-australia",
    title: "How much a turn-key racing simulator costs in Australia (2026)",
    description:
      "Real GST-inclusive bands for DIY parts, assembled rigs, haptic builds and full motion — Gold Coast built, delivered Australia-wide.",
    body: [
      "A parts kit from an online shop is not a turn-key simulator. Expect to pay several thousand dollars for chassis plus wheel and pedals with no PC and no professional assembly.",
      "Everything Simulated Starter packages are {{price:starter}} and arrive assembled, with a race PC and triples. Haptic systems are {{price:haptic}}. Full motion is {{price:motion}} including the motion platform.",
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
      "Hydraulic P1000 with haptics is made to order. Plan 3–5 weeks. Firmware lives in SimPro Manager on the included Windows 11 Pro PC.",
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

export function guideBySlug(slug: string) {
  return GUIDES.find((g) => g.slug === slug);
}

export function cityBySlug(slug: string) {
  return CITIES.find((c) => c.slug === slug);
}
