export type AgeBand = "U12" | "12-15" | "16-17" | "18+";

export type AmbassadorSeries =
  | "Kart"
  | "Sprint"
  | "Club"
  | "Carrera Cup"
  | "Junior pathway";

export type AmbassadorSocial = {
  instagram?: string;
  tiktok?: string;
  youtube?: string;
  facebook?: string;
};

export type Ambassador = {
  slug: string;
  name: string;
  program?: string;
  series: AmbassadorSeries[];
  season?: string;
  bio: string;
  base?: string;
  ageBand?: AgeBand;
  crate?: string;
  social?: AmbassadorSocial;
  published: boolean;
};

/** Public cards. Named people only when the agreement is current. */
export const AMBASSADORS: Ambassador[] = [
  {
    slug: "carter-cosgrove-racing",
    name: "Carter Cosgrove Racing",
    program: "Named program",
    series: ["Sprint", "Club"],
    season: "Workshop-backed program",
    bio: "A driver program the workshop has publicly stood with. Profile detail and socials land here as the agreement stays current.",
    base: "Queensland",
    published: true,
  },
];

export const AMBASSADOR_SERIES: { id: AmbassadorSeries; label: string; note: string }[] = [
  { id: "Kart", label: "Kart", note: "Cadet through senior kart. Junior pathway on an adjustable seat." },
  { id: "Sprint", label: "Sprint", note: "Weekend sprint and state-level race weekends." },
  { id: "Club", label: "Club", note: "Club championships and regular race meetings." },
  { id: "Carrera Cup", label: "Carrera Cup", note: "Porsche Carrera Cup and equivalent national tin-top." },
  { id: "Junior pathway", label: "Junior pathway", note: "Under 18. Guardian on the account. Age band, not a date of birth." },
];

export const AMBASSADOR_PROFILE_FIELDS = [
  { label: "Display name", note: "Race name is fine." },
  { label: "Photo", note: "Staff publish. Guardian sign-off if under 18." },
  { label: "Series / class", note: "Kart through Carrera Cup. Multi-select." },
  { label: "This season", note: "One line. What they are racing now." },
  { label: "Age band", note: "U12 / 12–15 / 16–17 / 18+. Never a date of birth." },
  { label: "Base", note: "City or region. Not a street." },
  { label: "Socials", note: "Instagram, TikTok, YouTube, Facebook URLs only." },
] as const;
