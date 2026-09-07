# Bolt.new port

This repository runs on **TanStack Start** in the Grok preview. Bolt.new prefers **Vite + React + TypeScript + Tailwind + Supabase (or Edge Functions)**.

Do **not** rewrite the business logic. Copy these files as-is:

```
src/lib/es/types.ts
src/lib/es/catalog.ts
src/lib/es/checkCart.ts
src/lib/es/cart-store.ts
src/lib/es/seo.ts
```

`checkCart` is the source of truth. The chatbot may only **explain** its JSON. Never let the model invent SKUs or override a `block`.

## Bolt scaffold

1. Create a Vite React-TS app with Tailwind.
2. Paste the files above into `src/lib/es/`.
3. Recreate routes as React Router / Bolt pages:
   - `/` marketing
   - `/builds/:slug`
   - `/shop/:sku`
   - `/compatibility`
   - `/au/:city`
   - `/guides/:slug`
   - `/app/*` customer (auth required)
   - `/staff/*` staff
4. Replace `createServerFn` in `src/lib/es/server.ts` with **Supabase Edge Functions** (or Bolt cloud functions) that:
   - read `auth.uid()` — never a client-sent user id
   - apply `migrations/0002_es.sql` (profiles, quotes, jobs, bookings, chat_messages, product_overrides)
5. Keep design tokens:

```css
--color-ink: #070708;
--color-panel: #111114;
--color-paper: #f4f4f5;
--color-esred: #E10600;
--radius-card: 15px;
```

Font: Outfit. Cards: 15px radius. No emoji icons.

## Auth mapping

| Here | Bolt / Supabase |
| --- | --- |
| Better Auth Google / X / email | Supabase Auth (Google + email). Add X if the project allows. |
| `authMiddleware` + `context.userId` | `auth.uid()` in RLS and Edge Functions |
| First profile becomes admin | Same rule in a `profiles` trigger |

## AI

Call xAI (`grok-4.5`) **from the server / edge function only**. Pass `checkCart()` JSON in the prompt. Cap `max_tokens`. User-initiated sends only.

## Images

Place workshop photos in `public/rigs/`: `hero.jpg`, `starter.jpg`, `haptic.jpg`, `motion.jpg`, `showroom.jpg`.
