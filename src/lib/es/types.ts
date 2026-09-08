export type ProductCategory =
  | "chassis"
  | "wheelbase"
  | "wheel"
  | "pedals"
  | "shifter"
  | "handbrake"
  | "seat"
  | "motion"
  | "monitor"
  | "mount"
  | "pc"
  | "audio"
  | "headset"
  | "software"
  | "adapter"
  | "accessory";

export type StockStatus = "stock" | "indent" | "discontinued";

export type Severity = "allow" | "adapter" | "warn" | "block";

export type StaffRole = "customer" | "sales" | "workshop" | "content" | "support" | "admin";

export type Product = {
  sku: string;
  brand: string;
  name: string;
  category: ProductCategory;
  sellExGst: number;
  costExGst?: number;
  stock: StockStatus;
  leadWeeks: [number, number];
  maxNm?: number;
  payloadKg?: number;
  weightKg?: number;
  mounts?: string[];
  qr?: string;
  notes?: string;
  image?: string;
  whatsIncluded?: string[];
  mountCompatibility?: string;
  assemblyManualUrl?: string;
  specs?: Record<string, string>;
  compare?: string;
};

export type CartLine = { sku: string; qty: number };

export type CompatibilityRule = {
  id: string;
  left: string;
  right: string;
  severity: Severity;
  reason: string;
  adapterSku?: string;
};

export type CheckIssue = {
  code: string;
  severity: Severity;
  message: string;
  fix?: string[];
  adapterSku?: string;
};

export type CheckResult = {
  ok: boolean;
  issues: CheckIssue[];
  totalExGst: number;
  totalIncGst: number;
  leadWeeks: [number, number];
};

export type PackageSpec = {
  slug: string;
  name: string;
  kicker: string;
  priceExGst: number;
  blurb: string;
  image: string;
  lines: CartLine[];
  highlights: string[];
  popular?: boolean;
};

export type Guide = {
  slug: string;
  title: string;
  description: string;
  body: string[];
};

export type CityPage = {
  slug: string;
  name: string;
  state: string;
  note: string;
};
