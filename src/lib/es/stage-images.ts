/**
 * Hero ("stage") photo for each static page. The pages read it from here, and the build
 * inlines the same map into index.html so the browser can start the LCP image before the
 * app's JavaScript has loaded (see stagePreload in vite.config.ts). Layout photos only;
 * product and prebuild images come from the database.
 */
export const STAGE_IMAGES = {
  "/": "/rigs/hero-poster.jpg",
  "/racing": "/rigs/motion.jpg",
  "/prebuilds": "/rigs/motion.jpg",
  "/shop": "/rigs/starter.jpg",
  "/compatibility": "/rigs/motion.jpg",
  "/ambassadors": "/rigs/haptic.jpg",
  "/contact": "/rigs/showroom.jpg",
  "/studio": "/rigs/showroom.jpg",
  "/events": "/rigs/showroom.jpg",
  "/faqs": "/rigs/haptic.jpg",
  "/partners": "/rigs/starter.jpg",
  "/drones": "/rigs/motion.jpg",
  "/aircraft": "/rigs/showroom.jpg",
  "/training": "/rigs/starter.jpg",
  "/guides": "/rigs/starter.jpg",
  "/au": "/rigs/showroom.jpg",
  "/privacy": "/rigs/showroom.jpg",
  "/terms": "/rigs/starter.jpg",
} as const;

export type StagePath = keyof typeof STAGE_IMAGES;

/** Inline script for index.html: preloads the current page's stage photo (WebP srcset). */
export function stagePreloadScript(widths: readonly number[] = [640, 1024, 1600]): string {
  const map: Record<string, string> = {};
  for (const [p, src] of Object.entries(STAGE_IMAGES)) {
    const m = /^\/rigs\/([A-Za-z0-9_+-]+)\.jpg$/.exec(src);
    if (m) map[p] = m[1];
  }
  return `(function(){var m=${JSON.stringify(map)};var p=location.pathname.replace(/\\/+$/,"")||"/";var n=m[p];if(!n)return;` +
    `var l=document.createElement("link");l.rel="preload";l.as="image";l.type="image/webp";l.setAttribute("fetchpriority","high");` +
    `l.setAttribute("imagesrcset",${JSON.stringify(widths.map((w) => `/rigs/{n}-${w}.webp ${w}w`).join(", "))}.split("{n}").join(n));` +
    `l.setAttribute("imagesizes","100vw");document.head.appendChild(l);})();`;
}
