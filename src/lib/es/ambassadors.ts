export type AgeBand = "U12" | "12-15" | "16-17" | "18+";

export type AmbassadorSocial = {
  instagram?: string;
  tiktok?: string;
  youtube?: string;
  facebook?: string;
};

/** Everything on the card is typed by the driver. No preset series list. */
export type Ambassador = {
  slug: string;
  name: string;
  photo?: string;
  bio: string;
  motorsport?: string;
  series?: string;
  className?: string;
  teamStatus?: string;
  base?: string;
  ageBand?: AgeBand;
  crate?: string;
  code: string;
  social?: AmbassadorSocial;
  published: boolean;
};

export function ambassadorLink(code: string) {
  return `/ambassadors?ref=${encodeURIComponent(code.toUpperCase())}`;
}

export function lookupAmbassadorCode(raw: string) {
  const code = raw.trim().toUpperCase();
  if (!code) return null;
  return AMBASSADORS.find((a) => a.published && a.code === code) ?? null;
}

/** Public cards. Named people only when the agreement is current. */
export const AMBASSADORS: Ambassador[] = [
  {
    slug: "carter-cosgrove-racing",
    name: "Carter Cosgrove Racing",
    bio: "A driver program the workshop has publicly stood with. Bio, series and socials are theirs to fill — this card updates when they send them.",
    motorsport: "Sprint / club racing",
    series: "",
    className: "",
    teamStatus: "Program",
    base: "Queensland",
    code: "COSGROVE",
    published: true,
  },
];

export const AMBASSADOR_PROFILE_FIELDS = [
  { label: "Photo", note: "Staff publish. Guardian sign-off if under 18." },
  { label: "Name", note: "Race name is fine." },
  { label: "Bio", note: "A few lines. They write it." },
  { label: "Motorsport", note: "The discipline they race. They type it — Carrera Cup, kart, sprint, whatever they run." },
  { label: "Series", note: "The championship they are in this season. Free text." },
  { label: "Class", note: "The class inside that series. Free text." },
  { label: "Team / status", note: "Privateer, works, family team — they type it." },
  { label: "Age band", note: "U12 / 12–15 / 16–17 / 18+. Never a date of birth." },
  { label: "Base", note: "City or region. Not a street." },
  { label: "Socials", note: "Instagram, TikTok, YouTube, Facebook URLs only." },
  { label: "Ambassador code", note: "Issued by the workshop. Used at checkout or on their link. Attributes the order. Not a discount." },
] as const;
