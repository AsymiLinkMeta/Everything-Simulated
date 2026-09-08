# Bolt.new

This repo is a **Vite + React + TypeScript + Tailwind v3** app. Open it in Bolt from GitHub.

## Header / footer must stay dark

Do **not** restyle header or footer with Tailwind-only utilities. Chrome lives in [`src/es.css`](src/es.css):

- `es-header` / `es-nav` / `es-nav-link` / `es-menu`
- `es-footer` / `es-footer-grid` / `es-footer-col`
- `es-logo` / `es-hero` / `es-card` / `es-btn`

`src/components/es/es-chrome.ts` imports `src/es.css` so Bolt always bundles the chrome stylesheet.

## Theme

```css
--es-ink: #070708;
--es-panel: #111114;
--es-paper: #f4f4f5;
--es-red: #E10600;
--es-radius: 15px;
```

Font: Outfit. Cards: 15px. No emoji icons.

## Domain logic (do not rewrite)

```
src/lib/es/catalog.ts
src/lib/es/checkCart.ts
src/lib/es/types.ts
src/lib/es/cart-store.ts
src/lib/es/product-cache.ts
```

`checkCart` is the source of truth. Chat may only explain its JSON.

## Supabase (required)

1. Apply every file in `supabase/migrations/` (including `20260908190000_ops_hardening.sql`).
2. Deploy Edge Functions:
   - `generate-product-listing` (needs `XAI_API_KEY` for Grok copy; falls back to a local draft)
   - `discover-products` (reads official Shopify/HTML catalogues)
   - `ask-builder`
   - `create-staff-account` (needs `SUPABASE_SERVICE_ROLE_KEY`)
3. Auth: email/password. Optional Google/X later — keep `GROK_PROVIDERS` empty until configured.
4. Do **not** use TanStack Start `createServerFn`. All staff/customer writes go through the Supabase client or these functions.

## Photos

Use `ListingImages` (drag-and-drop). Do not restyle manufacturer photos (no black background, no ES logo overlay).
