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
    blurb: "Turn-key crates, parts shop and a compatibility checker. The product line that already ships.",
    image: "/rigs/haptic.jpg",
  },
  {
    slug: "aircraft",
    to: "/aircraft",
    kicker: "Workshop platform",
    name: "Aircraft simulators",
    blurb: "Helicopter and fixed-wing cockpits specced and assembled on the Gold Coast. Studio consult, then a crate.",
    image: "/rigs/showroom.jpg",
  },
  {
    slug: "drones",
    to: "/drones",
    kicker: "Workshop platform",
    name: "Drone simulators",
    blurb: "Ground-station and FPV trainers for commercial and recreational operators. Book the studio to spec one.",
    image: "/rigs/motion.jpg",
  },
  {
    slug: "training",
    to: "/training",
    kicker: "Programs",
    name: "Training",
    blurb: "Driver, industrial and vehicle programs that sit on the same simulator platforms — not a separate product line.",
    image: "/rigs/starter.jpg",
  },
];

export const RACING_TOOLS: PlatformLink[] = [
  { to: "/prebuilds", label: "Prebuilds", hint: "Starter, Haptic and Motion crates, assembled here." },
  { to: "/shop", label: "Parts shop", hint: "The SKUs we actually bolt on. Not a warehouse catalogue." },
  { to: "/compatibility", label: "Checker", hint: "Torque, payload, QR and mounts. Chat cannot override a block." },
  { to: "/app/build", label: "Spec a crate", hint: "Customer app — walk the same steps the workshop uses." },
  { to: "/app/chat", label: "Build expert", hint: "AI copilot that only explains the checker JSON." },
  { to: "/studio", label: "Studio demo", hint: "Sit in the chassis on the Gold Coast before it ships." },
  { to: "/guides", label: "Guides", hint: "Cost, motion vs haptic, juniors, triples, delivery." },
  { to: "/faqs", label: "FAQs", hint: "Deposit, freight, lead times, warranty." },
];

export const AIRCRAFT_PAGES: PlatformLink[] = [
  { to: "/aircraft", label: "Overview", hint: "How we spec an aircraft cockpit." },
  { to: "/aircraft/helicopter", label: "Helicopter", hint: "Rotary cockpits for training and rehearsal." },
  { to: "/aircraft/flight", label: "Fixed-wing", hint: "Fixed-wing and jet trainers, same workshop." },
];

export const TRAINING_PAGES: PlatformLink[] = [
  { to: "/training", label: "Overview", hint: "Programs that run on our platforms." },
  { to: "/training/driver", label: "Driver", hint: "Kart, road and motorsport driver development." },
  { to: "/training/industrial", label: "Industrial", hint: "Plant, heavy vehicle and other vehicle programs." },
];

export const PARTNER_GROUPS: { title: string; items: { name: string; role: string }[] }[] = [
  {
    title: "Hardware",
    items: [
      { name: "Simagic", role: "Wheelbases, wheels, pedals, QR" },
      { name: "Trak Racer", role: "TR120S chassis" },
      { name: "Exodus", role: "XR1 motion-ready frames" },
      { name: "SIMRIG", role: "SR2 motion platforms" },
    ],
  },
  {
    title: "Events",
    items: [{ name: "Adrenaline Events", role: "Australia-wide racing simulator hire" }],
  },
  {
    title: "Industry",
    items: [{ name: "Workshop partners", role: "Training, teams and venues — enquire to be listed" }],
  },
];
