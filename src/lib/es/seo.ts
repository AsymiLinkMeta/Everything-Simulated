import { BRAND, CITIES, GUIDES, PACKAGES } from "./catalog";
import { livePackages } from "./prebuilds";
import { getCachedProducts } from "./product-cache";

export const ORIGIN = "https://everythingsimulated.com.au";

export function abs(path: string) {
  return `${ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

export function pageHead(opts: { title: string; description: string; path: string }) {
  return {
    meta: [
      { title: opts.title },
      { name: "description", content: opts.description },
      { name: "robots", content: "index,follow,max-image-preview:large" },
      { name: "author", content: BRAND.name },
      { name: "geo.region", content: "AU-QLD" },
      { name: "geo.placename", content: "Gold Coast" },
    ],
    links: [{ rel: "canonical", href: abs(opts.path) }],
  };
}

export function localBusinessLd() {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: BRAND.name,
    url: ORIGIN,
    telephone: BRAND.phone,
    email: BRAND.email,
    image: abs("/og.jpg"),
    priceRange: "$$$$",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Gold Coast",
      addressRegion: "QLD",
      addressCountry: "AU",
    },
    areaServed: CITIES.map((c) => ({ "@type": "City", name: c.name })),
    makesOffer: livePackages().map((p) => ({
      "@type": "Offer",
      name: p.name,
      priceCurrency: "AUD",
      price: (p.priceExGst / 100).toFixed(0),
      url: abs(`/prebuilds/${p.slug}`),
    })),
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
];

export const allIndexPaths = [
  "/",
  "/prebuilds",
  ...livePackages().map((p) => `/prebuilds/${p.slug}`),
  "/builds",
  ...PACKAGES.map((p) => `/builds/${p.slug}`),
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
  "/order",
];
