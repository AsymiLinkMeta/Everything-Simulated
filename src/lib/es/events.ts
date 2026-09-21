export type VenueOffer = {
  slug: string;
  kicker: string;
  title: string;
  blurb: string;
};

/** Planned warehouse capacity. Not a hire catalogue. */
export const VENUE = {
  size: "about 200 square metres",
  status: "planned capacity",
  note: "No live street address and no public hire list until the lease is real. Enquire.",
} as const;

export const VENUE_OFFERS: VenueOffer[] = [
  {
    slug: "corporate",
    kicker: "Corporate",
    title: "Company days on the floor",
    blurb:
      "Host a team or client session on the same site as the build studio. Rigs, briefing space and a run sheet we write with you. Enquire — not a package menu.",
  },
  {
    slug: "pro-group",
    kicker: "Group training · professional",
    title: "Race drivers, together",
    blurb:
      "Squad or team hours for drivers already in a series — sprint through Carrera Cup. Four-screen coaching layouts, coach in the room if you bring one.",
  },
  {
    slug: "amateur-group",
    kicker: "Group training · amateur",
    title: "Club, sprint and juniors",
    blurb:
      "Club days and amateur groups on the racing crates. Juniors with a parent or guardian. Torque stays capped unless a coach asks otherwise.",
  },
  {
    slug: "catering",
    kicker: "Catering",
    title: "Food on site when the booking needs it",
    blurb:
      "On-site catering for corporate and group sessions. We arrange it against the booking — not a public kitchen or walk-in menu.",
  },
];

export const VENUE_FLOOR = [
  {
    kicker: "Floor",
    title: "Warehousing",
    blurb: "Incoming chassis, outgoing crates. Not open browse.",
  },
  {
    kicker: "Back",
    title: "Build studio",
    blurb: "Assembly, fitment, try-before-you-buy on the same site.",
  },
  {
    kicker: "Events",
    title: "Corporate + group days",
    blurb: "Professional and amateur driver groups, plus company bookings.",
  },
  {
    kicker: "Catering",
    title: "On-site food",
    blurb: "Arranged when a booking needs it. Ask first.",
  },
] as const;
