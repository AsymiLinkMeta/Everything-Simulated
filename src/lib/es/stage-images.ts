/**
 * Hero ("stage") photo for each static page. The pages read it from here, and the build
 * inlines the same map into index.html so the browser can start the LCP image before the
 * app's JavaScript has loaded (see stagePreload in vite.config.ts). Layout photos only;
 * product and prebuild images come from the database.
 */
export const STAGE_IMAGES = {
  "/": "/rigs/es-hero-wide-pr1.jpg",
  "/racing": "/rigs/es-cat-motion-pr2.jpg",
  "/prebuilds": "/rigs/es-cat-screens-pr2.jpg",
  "/compatibility": "/rigs/es-cat-chassis-pr2.jpg",
  "/ambassadors": "/rigs/es-cat-seat-pr2.jpg",
  "/studio": "/rigs/es-cat-wheel-pr2.jpg",
  "/events": "/rigs/es-cat-screens-pr2.jpg",
  "/drones": "/rigs/es-cat-pc-pr2.jpg",
  "/aircraft": "/rigs/es-cat-shifter-pr2.jpg",
  "/training": "/rigs/es-cat-pedals-pr2.jpg",
} as const;

/** Art-directed portrait crops for phones (max-width: 767px). Same naming as STAGE_IMAGES. */
export const STAGE_IMAGES_MOBILE: Partial<Record<keyof typeof STAGE_IMAGES, string>> = {
  "/": "/rigs/es-hero-tall-pr2.jpg",
};

export const MOBILE_MEDIA = "(max-width: 767px)";

export type StagePath = keyof typeof STAGE_IMAGES;

/** Inline script for index.html: preloads the current page's stage photo (WebP srcset). */
export function stagePreloadScript(widths: readonly number[] = [640, 1024, 1600]): string {
  const name = (src: string | undefined) => (src ? /^\/rigs\/([A-Za-z0-9_+-]+)\.jpg$/.exec(src)?.[1] : undefined);
  const map: Record<string, string> = {};
  const mobile: Record<string, string> = {};
  for (const [p, src] of Object.entries(STAGE_IMAGES)) {
    const n = name(src);
    if (n) map[p] = n;
    const mn = name(STAGE_IMAGES_MOBILE[p as keyof typeof STAGE_IMAGES]);
    if (mn) mobile[p] = mn;
  }
  return `(function(){var m=${JSON.stringify(map)},q=${JSON.stringify(mobile)};var p=location.pathname.replace(/\\/+$/,"")||"/";var n=m[p];if(!n)return;` +
    `if(q[p]&&typeof matchMedia=="function"&&matchMedia(${JSON.stringify(MOBILE_MEDIA)}).matches)n=q[p];` +
    `var l=document.createElement("link");l.rel="preload";l.as="image";l.type="image/webp";l.setAttribute("fetchpriority","high");` +
    `l.setAttribute("imagesrcset",${JSON.stringify(widths.map((w) => `/rigs/{n}-${w}.webp ${w}w`).join(", "))}.split("{n}").join(n));` +
    `l.setAttribute("imagesizes","100vw");document.head.appendChild(l);})();`;
}
