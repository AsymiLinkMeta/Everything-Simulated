import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "@/lib/auth/provider";
import { AppProviders } from "@/components/es/providers";
import { ScrollManager } from "@/components/es/scroll-manager";
import { fetchProducts } from "@/lib/es/product-cache";
import { hydratePrebuilds } from "@/lib/es/prebuilds";
import "./es.css";
import "./index.css";

// Warm the catalogue and prebuild caches once the page has painted. Pages that need the
// data on first render ask for it themselves; this only fills the cache for later
// navigation, so it must not compete with the route's own JS and hero image.
function warmCaches() {
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
