# Everything Simulated

Premium Gold Coast sim-racing workshop: marketing site, parts shop, compatibility checker, customer build app, and staff portal.

**Live product surfaces**

| Surface | Path | Who |
| --- | --- | --- |
| Marketing + SEO | `/` | Everyone |
| Shop + checker | `/shop`, `/compatibility` | Guests (cart in the browser) |
| Customer app | `/app` | Signed-in customers |
| Staff / admin | `/staff` | sales, workshop, content, support, admin |

Admins are created explicitly (allowlisted, verified email or `promote_admin()` in the SQL editor; see [docs/ENV.md](docs/ENV.md#admin-bootstrap)). Admins create staff and customers. Staff can add **customer** logins only. The last admin cannot be demoted.

## Stack

Vite + React 18 + React Router + Tailwind v3 + Supabase Auth + Postgres.

Domain logic lives in `src/lib/es/` (no UI framework):

- `catalog.ts` — packages, guides, city SEO, fallback products, default rules
- `checkCart.ts` — deterministic compatibility engine
- `product-cache.ts` — live `catalog_products` (published only) with seed fallback
- `rules.ts` — staff-editable compatibility graph
- `crm-oms.ts` — CRM pipeline + OMS fulfilment

Setup: apply `supabase/migrations/*`, deploy the Edge Functions (see [DEPLOY.md](DEPLOY.md)). Do not rewrite the checker.

## Conventions

- **Header and footer stay dark.** Don't restyle them with Tailwind-only utilities. The site chrome lives in [`src/es.css`](src/es.css) (`es-header`, `es-nav`, `es-nav-link`, `es-menu`, `es-footer`, `es-footer-grid`, `es-footer-col`, `es-logo`, `es-hero`, `es-card`, `es-btn`). `src/components/es/es-chrome.ts` imports it so the chrome stylesheet is always bundled.
- **Theme tokens:** `--es-ink: #070708`, `--es-panel: #111114`, `--es-paper: #f4f4f5`, `--es-red: #E10600`, `--es-radius: 15px`. Fonts: Outfit (body), Teko (headings). Cards use the 15px radius. No emoji icons.
- **Domain logic, do not rewrite:** `catalog.ts`, `checkCart.ts`, `types.ts`, `cart-store.ts`, `product-cache.ts` in `src/lib/es/`. `checkCart` is the source of truth; the chat assistant may only explain its JSON.
- **No server functions in the frontend.** Don't use TanStack Start `createServerFn`. All staff and customer writes go through the Supabase client, RPCs or the Edge Functions.
- **Auth:** email/password with **Confirm email** on. The first admin comes from `admin_bootstrap_emails` (docs/ENV.md). Keep `GROK_PROVIDERS` empty until Google/X sign-in is configured.
- **Product photos:** use `ListingImages` (drag and drop). Don't restyle manufacturer photos (no black background, no ES logo overlay).

## Catalogue workflow

1. SKU search or paste a manufacturer URL (product or collection).
2. AI writes a **draft** listing from official page data (photos stay as-is).
3. Staff set the AU price, then **Publish to shop**.
4. Compatibility rules are linked separately under Staff → Rules.

## Checkout (honest)

There is no Stripe key in this repo. Without one, customers **save a quote** and **place a deposit order** (status `pending`). Staff mark paid / pack / ship in OMS, which decrements `qty_on_hand` and issues an invoice number.

With `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` set on the Edge Functions, customers can pay a 30% deposit (minimum $500, never more than the total) through Stripe Checkout. The webhook verifies signatures, rejects stale events and applies each event once.

## SEO

- Unique title/description per city, guide, package and SKU
- JSON-LD LocalBusiness, FAQ, Product, Breadcrumb
- `/au/{city}` landing pages
- `public/sitemap.xml` + `public/robots.txt` + `public/llms.txt`
- One public host everywhere: `VITE_SITE_URL` (default `https://www.everythingsimulated.com.au`), rewritten into the static files at build time
- `VITE_NOINDEX=true` on staging/previews

## Scripts

```bash
npm install
cp .env.example .env.local   # fill in Supabase URL + anon key
npm run dev

npm run typecheck        # tsc, strict mode
npm run lint             # eslint, zero warnings
npm test                 # vitest: checker rules, deposit maths, webhook signatures, mail auth, CORS, SEO/redirects
npm run build
npm run ci               # all of the above

npm run check:functions  # deno check on every Edge Function (needs Deno)
npm run test:db          # replay all migrations on a fresh Supabase Postgres + RLS/admin tests (needs Docker + psql)
```

GitHub Actions runs all of these on every pull request (`.github/workflows/ci.yml`).

## Deploying

- Environment variables: [docs/ENV.md](docs/ENV.md)
- Staging, production and the Wix cutover (with the 301 map): [DEPLOY.md](DEPLOY.md)
