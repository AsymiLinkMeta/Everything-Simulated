# Everything Simulated

Premium Gold Coast sim-racing workshop: marketing site, parts shop, compatibility checker, customer build app, and staff portal.

**Live product surfaces**

| Surface | Path | Who |
| --- | --- | --- |
| Marketing + SEO | `/` | Everyone |
| Shop + checker | `/shop`, `/compatibility` | Guests (cart in the browser) |
| Customer app | `/app` | Signed-in customers |
| Staff / admin | `/staff` | sales, workshop, content, support, admin |

The first signed-in account becomes **admin**. Admins create staff and customers. Staff can add **customer** logins only. The last admin cannot be demoted.

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

There is no Stripe key in this repo. Customers **save a quote** and **place a deposit order** (status `pending`). Staff mark paid / pack / ship in OMS, which decrements `qty_on_hand` and issues an invoice number.

## SEO

- Unique title/description per city, guide, package and SKU
- JSON-LD LocalBusiness, FAQ, Product, Breadcrumb
- `/au/{city}` landing pages
- `public/sitemap.xml` + `public/robots.txt`

## Scripts

```bash
npm install
npm run dev
npm run build
```
