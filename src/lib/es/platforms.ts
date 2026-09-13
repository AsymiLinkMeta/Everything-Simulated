export type PlatformLink = { to: string; label: string; hint: string };

export const PLATFORMS: {
  slug: string;
  to: string;
  kicker: string;
  name: string;
  blurb: string;
  image: string;
}[] = [
  {
    slug: "racing",
    to: "/racing",
    kicker: "Live catalogue",
    name: "Racing simulators",
    blurb:
      "Motion, haptic and triple-plus-aux crates that already ship. Simagic, Trak Racer, Exodus and Dynamix — checker before deposit.",
    image: "/rigs/haptic.jpg",
  },
  {
    slug: "aircraft",
    to: "/aircraft",
    kicker: "Workshop platform",
    name: "Aircraft simulators",
    blurb:
      "Helicopter cockpits from the same Gold Coast floor. Studio consult, then a crate — no invented type-rating shop.",
    image: "/rigs/showroom.jpg",
  },
  {
    slug: "drones",
    to: "/drones",
    kicker: "Workshop platform",
    name: "Drone simulators",
    blurb:
      "FPV and ground-station trainers for commercial and recreational operators. Capacity we spec with you, not a parts list.",
    image: "/rigs/motion.jpg",
  },
  {
    slug: "training",
    to: "/training",
    kicker: "Programs",
    name: "Training",
    blurb:
      "Motorsport, driver, aviation, drone and industrial hours on the platforms above. Programs, not a second hardware shop.",
    image: "/rigs/starter.jpg",
  },
];

export const RACING_TOOLS: PlatformLink[] = [
  { to: "/prebuilds", label: "Prebuilds", hint: "Starter, Haptic and Motion crates — triples plus an aux screen on the upper two." },
  { to: "/shop", label: "Parts shop", hint: "The SKUs we actually bolt on. Not a warehouse catalogue." },
  { to: "/compatibility", label: "Checker", hint: "Torque, payload, QR and mounts. Chat cannot override a block." },
  { to: "/app/build", label: "Spec a crate", hint: "Customer app — walk the same steps the workshop uses." },
  { to: "/app/chat", label: "Build expert", hint: "AI copilot that only explains the checker JSON." },
  { to: "/studio", label: "Studio demo", hint: "Try before you buy on the Gold Coast. Call Taylah to book." },
  { to: "/guides", label: "Guides", hint: "Cost, motion vs haptic, juniors, triples, delivery." },
  { to: "/faqs", label: "FAQs", hint: "Deposit, freight, lead times, warranty." },
];

export const AIRCRAFT_PAGES: PlatformLink[] = [
  { to: "/aircraft", label: "Overview", hint: "How we spec an aircraft cockpit." },
  { to: "/aircraft/helicopter", label: "Helicopter", hint: "Rotary cockpits for training and rehearsal — studio first." },
  { to: "/aircraft/flight", label: "Fixed-wing", hint: "Fixed-wing and jet trainers, same workshop." },
];

export const TRAINING_PAGES: PlatformLink[] = [
  { to: "/training", label: "Overview", hint: "Programs that run on our platforms." },
  { to: "/training/driver", label: "Driver", hint: "Kart, junior pathway and motorsport — four-screen coaching setups." },
  { to: "/training/industrial", label: "Industrial", hint: "Truck, side-kart, excavator and plant — enquire, not a catalogue." },
];

export const PARTNER_GROUPS: { title: string; items: { name: string; role: string }[] }[] = [
  {
    title: "Hardware",
    items: [
      { name: "Simagic", role: "Wheelbases, wheels, pedals, QR" },
      { name: "Trak Racer", role: "TR120S chassis · Alpine / TRX collaboration" },
      { name: "Exodus", role: "XR1 motion-ready frames" },
      { name: "SIMRIG", role: "SR2 motion platforms" },
      { name: "Dynamix", role: "Motion and haptic systems we spec on Gold Coast builds" },
    ],
  },
  {
    title: "Events",
    items: [
      { name: "Adrenalin Events", role: "Australia-wide racing simulator hire" },
      { name: "Circolo Software", role: "Event and experience software partner" },
    ],
  },
  {
    title: "Industry",
    items: [
      { name: "Player1", role: "Partnership announced January 2026" },
      { name: "Workshop partners", role: "Training, teams and venues — enquire to be listed" },
    ],
  },
];
