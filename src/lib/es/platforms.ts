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
      "Turn-key racing simulators with motion, haptic feedback and triple-plus-auxiliary screens. Simagic, Trak Racer, Exodus and Dynamix — compatibility verified before deposit.",
    image: "/rigs/haptic.jpg",
  },
  {
    slug: "aircraft",
    to: "/aircraft",
    kicker: "Workshop platform",
    name: "Aircraft simulators",
    blurb:
      "Helicopter and fixed-wing cockpit simulators built on the same Gold Coast floor. Every aircraft build starts with a studio consultation.",
    image: "/rigs/showroom.jpg",
  },
  {
    slug: "drones",
    to: "/drones",
    kicker: "Workshop platform",
    name: "Drone simulators",
    blurb:
      "Purpose-built FPV and ground-station trainers for commercial and recreational operators. Specced to your mission requirements.",
    image: "/rigs/motion.jpg",
  },
  {
    slug: "training",
    to: "/training",
    kicker: "Programs",
    name: "Training",
    blurb:
      "Motorsport, driver coaching, aviation and industrial training programs. Professional instruction on the simulators we build.",
    image: "/rigs/starter.jpg",
  },
];

export const HOME_DOORS: { to: string; image: string; kicker: string; title: string; hint: string }[] = [
  { to: "/prebuilds", image: "/rigs/haptic.jpg", kicker: "Live", title: "Prebuilds", hint: "Starter, Haptic and Motion packages ready to ship." },
  { to: "/shop", image: "/rigs/starter.jpg", kicker: "Parts", title: "Shop", hint: "Every component we install, wire and ship." },
  { to: "/ambassadors", image: "/rigs/motion.jpg", kicker: "People", title: "Ambassadors", hint: "The drivers we support and the rigs they train on." },
  { to: "/studio", image: "/rigs/showroom.jpg", kicker: "Floor", title: "Studio", hint: "Test-drive your build before dispatch." },
];

export const RACING_TOOLS: PlatformLink[] = [
  { to: "/prebuilds", label: "Prebuilds", hint: "Starter, Haptic and Motion crates — triples plus an aux screen on the upper two." },
  { to: "/shop", label: "Parts shop", hint: "The SKUs we actually bolt on. Not a warehouse catalogue." },
  { to: "/compatibility", label: "Checker", hint: "Torque, payload, QR and mounts. Chat cannot override a block." },
  { to: "/app/build", label: "Spec a crate", hint: "Customer app — walk the same steps the workshop uses." },
  { to: "/app/chat", label: "Build expert", hint: "AI copilot that only explains the checker JSON." },
  { to: "/studio", label: "Studio demo", hint: "Try before you buy on the Gold Coast. Call the workshop to book." },
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
  { to: "/events", label: "Group days", hint: "Professional and amateur driver groups at the warehouse, with catering." },
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
