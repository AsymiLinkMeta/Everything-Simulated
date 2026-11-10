import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "@/lib/auth/provider";
import { AppProviders } from "@/components/es/providers";
import { ScrollManager } from "@/components/es/scroll-manager";
import { fetchProducts } from "@/lib/es/product-cache";
import { hydratePrebuilds } from "@/lib/es/prebuilds";
import { fetchSiteMedia } from "@/lib/es/site-media";
import "./es.css";
import "./index.css";

// Warm the catalogue and prebuild caches once the page has painted. Pages that need the
// data on first render ask for it themselves; this only fills the cache for later
// navigation, so it must not compete with the route's own JS and hero image.
// Only routes where a catalogue or prebuild page is a likely next click warm the cache;
// policy, sign-in, account and staff pages never pay for it.
const WARM_PATHS = /^\/(?:$|shop|build|builds|prebuilds|racing|compatibility|checkout|order|studio|ambassadors|drivers|au)(?:\/|$)/;
function shouldWarm(path: string) {
  return WARM_PATHS.test(path);
}
function warmCaches() {
  if (!shouldWarm(window.location.pathname)) return;
  fetchProducts().catch(() => {});
  hydratePrebuilds().catch(() => {});
}
function whenIdle() {
  // A short delay after load keeps these large responses off the critical path on slow
  // connections (they otherwise share bandwidth with the hero image).
  setTimeout(idle, 3000);
}
function idle() {
  const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (ric) ric(warmCaches, { timeout: 3000 });
  else setTimeout(warmCaches, 1);
}
// On shop and product pages the LCP image is a catalogue tile whose art comes from
// catalog_products + site_media. Start both requests now, in parallel with the page's
// lazy chunk, instead of after it has loaded and rendered.
if (/^\/shop(?:\/|$)/.test(window.location.pathname)) {
  fetchProducts().catch(() => {});
  fetchSiteMedia().catch(() => {});
}

if (document.readyState === "complete") whenIdle();
else window.addEventListener("load", whenIdle, { once: true });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AppProviders>
          <App />
          <ScrollManager />
        </AppProviders>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
