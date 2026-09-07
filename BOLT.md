# Bolt.new

This repo is a **Vite + React + TypeScript + Tailwind v3** app. Open it in Bolt from GitHub.

## Header / footer must stay dark

Do **not** restyle header or footer with Tailwind-only utilities. Chrome lives in [`src/es.css`](src/es.css) and is imported from the shells:

- `es-header` / `es-nav` / `es-nav-link` / `es-menu`
- `es-footer` / `es-footer-grid` / `es-footer-col`
- `es-logo` / `es-logo-mark` / `es-logo-word`
- `es-hero` / `es-card` / `es-btn`

Those classes are plain CSS. They render even if Tailwind tokens (`bg-ink`, `text-paper`) are missing.

`src/components/es/es-chrome.ts` imports `src/es.css` so Bolt always bundles the chrome stylesheet with the header.

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
```

`checkCart` is the source of truth. Chat may only explain its JSON.

## Auth / data in Bolt

Wire Supabase Auth in place of the stubs under `src/lib/auth/*`. Apply `migrations/0002_es.sql`. Replace `src/lib/es/server.ts` `createServerFn` calls with Edge Functions using `auth.uid()`.
