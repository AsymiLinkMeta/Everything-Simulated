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
export type ListingStatus = "draft" | "published" | "archived";
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
  listingStatus?: ListingStatus;
  qtyOnHand?: number;
  leadWeeks: [number, number];
  maxNm?: number;
  payloadKg?: number;
  weightKg?: number;
  mounts?: string[];
  qr?: string;
  notes?: string;
  image?: string;
  images?: string[];
  description?: string;
  whatsIncluded?: string[];
  mountCompatibility?: string;
  assemblyManualUrl?: string;
  specs?: Record<string, string>;
  compare?: string;
  /** catalog_products.sell_ex_gst before any override. sellExGst is the effective price. */
  basePriceExGst?: number;
  overrideExGst?: number;
  /** Sold by enquiry only: no add-to-cart. */
  enquiryOnly?: boolean;
  /** Published, priced above $0 and not enquiry-only. */
  purchasable?: boolean;
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
  freightExGst: number;
  leadWeeks: [number, number];
};

export type PackageSpec = {
  /** Prebuild id, when the package came from the database. */
  id?: string;
  /** Image not loaded yet (see PrebuildPhoto). */
  imageDeferred?: boolean;
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
