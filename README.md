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

## Stack (this repo / Bolt.new)

Vite + React 18 + React Router + Tailwind v3 + Supabase Auth + Postgres.

Domain logic lives in `src/lib/es/` (no UI framework):

- `catalog.ts` — packages, guides, city SEO, fallback products, default rules
- `checkCart.ts` — deterministic compatibility engine
- `product-cache.ts` — live `catalog_products` (published only) with seed fallback
- `rules.ts` — staff-editable compatibility graph
- `crm-oms.ts` — CRM pipeline + OMS fulfilment

**Bolt.new:** see [BOLT.md](./BOLT.md). Apply `supabase/migrations/*`. Deploy the Edge Functions. Do not rewrite the checker.

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
