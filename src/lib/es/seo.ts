import { BRAND, CITIES, GUIDES, PACKAGES } from "./catalog";
import { livePackages } from "./prebuilds";
import { getCachedProducts } from "./product-cache";
import type { Guide, Product } from "./types";

export const ORIGIN = "https://everythingsimulated.com.au";
export const OG_IMAGE = `${ORIGIN}/og.jpg`;
export const LOGO = `${ORIGIN}/Everything_Simulated_LOGO_W+R.png`;
export const SAME_AS = [
  "https://www.facebook.com/EverythingSimulated/",
  "https://www.instagram.com/everything_simulated/",
] as const;

export function abs(path: string) {
  if (!path) return ORIGIN;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

export type PageHeadOpts = {
  title: string;
  description: string;
  path: string;
  image?: string;
  type?: "website" | "article" | "product";
  index?: boolean;
};

export function pageHead(opts: PageHeadOpts) {
  const url = abs(opts.path);
  const image = abs(opts.image || "/og.jpg");
  const index = opts.index !== false;
  const robots = index
    ? "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"
    : "noindex,nofollow";
  return {
    meta: [
      { title: opts.title },
      { name: "description", content: opts.description },
      { name: "robots", content: robots },
      { name: "googlebot", content: robots },
      { name: "author", content: BRAND.name },
      { name: "geo.region", content: "AU-QLD" },
      { name: "geo.placename", content: "Gold Coast" },
      { name: "geo.position", content: "-28.0167;153.4000" },
      { name: "ICBM", content: "-28.0167, 153.4000" },
      { name: "language", content: "en-AU" },
      { property: "og:type", content: opts.type ?? "website" },
      { property: "og:site_name", content: BRAND.name },
      { property: "og:locale", content: "en_AU" },
      { property: "og:title", content: opts.title },
      { property: "og:description", content: opts.description },
      { property: "og:url", content: url },
      { property: "og:image", content: image },
      { property: "og:image:alt", content: `${BRAND.name} — Gold Coast racing simulators` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: opts.title },
      { name: "twitter:description", content: opts.description },
      { name: "twitter:image", content: image },
    ],
    links: [
      { rel: "canonical", href: url },
      { rel: "alternate", hreflang: "en-AU", href: url },
      { rel: "alternate", hreflang: "x-default", href: url },
    ],
  };
}

export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${ORIGIN}/#org`,
    name: BRAND.name,
    url: ORIGIN,
    logo: { "@type": "ImageObject", url: LOGO },
    image: OG_IMAGE,
    telephone: BRAND.phone,
    email: BRAND.email,
    sameAs: [...SAME_AS],
    address: {
      "@type": "PostalAddress",
      addressLocality: "Gold Coast",
      addressRegion: "QLD",
      addressCountry: "AU",
    },
    contactPoint: {
      "@type": "ContactPoint",
      telephone: BRAND.phone,
      contactType: "sales",
      areaServed: "AU",
      availableLanguage: "English",
    },
  };
}

export function websiteLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${ORIGIN}/#website`,
    url: ORIGIN,
    name: BRAND.name,
    inLanguage: "en-AU",
    publisher: { "@id": `${ORIGIN}/#org` },
    description:
      "Gold Coast assembled racing simulators. Simagic, Trak Racer, Exodus and SIMRIG. Compatibility checked before deposit. Crate freight Australia-wide.",
  };
}

export function localBusinessLd(cityName?: string) {
  const packs = livePackages().length ? livePackages() : PACKAGES;
  return {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "Store"],
    "@id": `${ORIGIN}/#business`,
    name: BRAND.name,
    url: ORIGIN,
    telephone: BRAND.phone,
    email: BRAND.email,
    image: OG_IMAGE,
    logo: LOGO,
    priceRange: "$$$$",
    currenciesAccepted: "AUD",
    paymentAccepted: "Credit card",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Gold Coast",
      addressRegion: "QLD",
      addressCountry: "AU",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: -28.0167,
      longitude: 153.4,
    },
    areaServed: cityName
      ? { "@type": "City", name: cityName }
      : CITIES.map((c) => ({ "@type": "City", name: c.name })),
    sameAs: [...SAME_AS],
    parentOrganization: { "@id": `${ORIGIN}/#org` },
    makesOffer: packs.map((p) => ({
      "@type": "Offer",
      name: p.name,
      priceCurrency: "AUD",
      price: p.priceExGst ? (p.priceExGst / 100).toFixed(0) : undefined,
      url: abs(`/prebuilds/${p.slug}`),
    })),
    knowsAbout: [
      "Sim racing",
      "Simagic",
      "Trak Racer",
      "Exodus",
      "SIMRIG",
      "Direct drive wheelbases",
      "Motion simulators",
    ],
  };
}

export function faqLd(items: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

export function breadcrumbLd(parts: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: parts.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: p.name,
      item: abs(p.path),
    })),
  };
}

export function itemListLd(name: string, path: string, items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    url: abs(path),
    isPartOf: { "@id": `${ORIGIN}/#website` },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: items.length,
      itemListElement: items.map((it, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: it.name,
        url: abs(it.path),
      })),
    },
  };
}

export function productLd(input: {
  name: string;
  sku?: string;
  brand?: string;
  description?: string;
  image?: string;
  priceExGst?: number;
  url: string;
  availability?: "InStock" | "PreOrder" | "OutOfStock";
  category?: string;
  extras?: { name: string; value: string }[];
}) {
  const extras = (input.extras ?? [])
    .filter((e) => e.value)
    .map((e) => ({ "@type": "PropertyValue", name: e.name, value: e.value }));
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.name,
    sku: input.sku,
    mpn: input.sku,
    description: input.description,
    image: input.image ? abs(input.image) : OG_IMAGE,
    brand: { "@type": "Brand", name: input.brand ?? BRAND.name },
    category: input.category,
    additionalProperty: extras.length ? extras : undefined,
    offers: {
      "@type": "Offer",
      url: abs(input.url),
      priceCurrency: "AUD",
      price: input.priceExGst && input.priceExGst > 0 ? (input.priceExGst / 100).toFixed(2) : undefined,
      availability: `https://schema.org/${input.availability ?? "InStock"}`,
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@id": `${ORIGIN}/#org` },
      areaServed: { "@type": "Country", name: "Australia" },
    },
  };
}

export function catalogProductLd(item: Product) {
  return productLd({
    name: `${item.brand} ${item.name}`,
    sku: item.sku,
    brand: item.brand,
    description: item.description || item.notes,
    image: item.image || item.images?.[0],
    priceExGst: item.sellExGst,
    url: `/shop/${item.sku}`,
    availability: item.stock === "stock" ? "InStock" : item.stock === "discontinued" ? "OutOfStock" : "PreOrder",
    category: item.category,
    extras: [
      item.maxNm ? { name: "Peak torque", value: `${item.maxNm} Nm` } : { name: "", value: "" },
      item.payloadKg ? { name: "Payload", value: `${item.payloadKg} kg` } : { name: "", value: "" },
      item.weightKg ? { name: "Weight", value: `${item.weightKg} kg` } : { name: "", value: "" },
      item.mounts?.length ? { name: "Mounts", value: item.mounts.join(", ") } : { name: "", value: "" },
      item.qr ? { name: "QR", value: item.qr } : { name: "", value: "" },
    ],
  });
}

export function articleLd(guide: Guide) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.description,
    image: OG_IMAGE,
    datePublished: "2026-09-01",
    dateModified: "2026-09-11",
    inLanguage: "en-AU",
    author: { "@id": `${ORIGIN}/#org` },
    publisher: { "@id": `${ORIGIN}/#org` },
    mainEntityOfPage: abs(`/guides/${guide.slug}`),
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: ["h1", "article p"],
    },
  };
}

export function serviceLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Gold Coast sim racing studio demo",
    serviceType: "Showroom fitting and build consult",
    provider: { "@id": `${ORIGIN}/#org` },
    areaServed: { "@type": "City", name: "Gold Coast" },
    url: abs("/studio"),
    description:
      "Sit in Starter, Haptic and Motion rigs at the Gold Coast workshop. Pedal spacing and wheel height are set before the crate leaves.",
  };
}

export function contactPageLd() {
  return {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    url: abs("/contact"),
    name: `Contact ${BRAND.name}`,
    mainEntity: { "@id": `${ORIGIN}/#org` },
  };
}

export function graphLd(...nodes: Record<string, unknown>[]) {
  return {
    "@context": "https://schema.org",
    "@graph": nodes.map((n) => {
      const copy = { ...n };
      delete copy["@context"];
      return copy;
    }),
  };
}

export const FAQS = [
  {
    q: "How much does a turn-key racing simulator cost in Australia?",
    a: "Everything Simulated Starter packages start at $11,260 + GST. Haptic builds are $18,999 + GST. Full motion with SIMRIG SR2 is $28,999 + GST. Freight is crate-based Australia-wide from the Gold Coast.",
  },
  {
    q: "Do you deliver outside the Gold Coast?",
    a: "Yes. Every rig is assembled and QA'd on the Gold Coast, then crate-freighted Australia-wide. Optional white-glove install covers capital cities; regional is quoted.",
  },
  {
    q: "Can I try a simulator before buying?",
    a: "Book a Gold Coast showroom session. We set pedal spacing and wheel height on the actual chassis before the crate leaves.",
  },
  {
    q: "Will Simagic parts fit a Trak Racer or Exodus chassis?",
    a: "The build app runs a deterministic compatibility checker before deposit. Alpha EVO on TR120S needs the Simagic side-mount kit. SR2 motion is Exodus XR1 only.",
  },
  {
    q: "How long does a Gold Coast build take?",
    a: "Lead time is typically 3–6 weeks from deposit. Hydraulic P1000 haptics and motion platforms can sit at the longer end when parts are indent.",
  },
  {
    q: "Is the compatibility checker just a chatbot?",
    a: "No. Chat may only explain the checker JSON. Unique categories, torque, payload, QR and mounts are enforced by rules. A blocked crate cannot be overridden by AI.",
  },
];

export const allIndexPaths = [
  "/",
  "/prebuilds",
  ...(livePackages().length ? livePackages() : PACKAGES).map((p) => `/prebuilds/${p.slug}`),
  "/shop",
  ...getCachedProducts().map((p) => `/shop/${p.sku}`),
  "/compatibility",
  "/studio",
  "/guides",
  "/faqs",
  ...GUIDES.map((g) => `/guides/${g.slug}`),
  "/au",
  ...CITIES.map((c) => `/au/${c.slug}`),
  "/contact",
  "/privacy",
  "/terms",
];
