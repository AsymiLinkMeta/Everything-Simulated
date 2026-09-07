# Everything Simulated

Premium Gold Coast sim-racing workshop: marketing site, parts shop, compatibility checker, customer build app, and staff portal.

**Live product surfaces**

| Surface | Path | Who |
| --- | --- | --- |
| Marketing + SEO | `/` | Everyone |
| Shop + checker | `/shop`, `/compatibility` | Guests (cart in the browser) |
| Customer app | `/app` | Signed-in customers |
| Staff / admin | `/staff` | sales, workshop, content, support, admin |

The first signed-in account becomes **admin**.

## Packages

- Starter — $11,260 + GST
- Haptic — $18,999 + GST (default cart)
- Motion — $28,999 + GST (SIMRIG SR2 on Exodus XR1 only)

Brands specced: Simagic, Trak Racer, Exodus, SIMRIG, AOC, Logitech, iRacing.

## Stack (this repo)

TanStack Start + React 19 + Tailwind v4 + Better Auth (Google / X / email) + Postgres.

Portable domain logic lives in `src/lib/es/` (no UI framework):

- `catalog.ts` — products, packages, guides, city SEO pages, rules
- `checkCart.ts` — deterministic compatibility engine
- `types.ts` — shared types

**Bolt.new:** see [BOLT.md](./BOLT.md). Copy `src/lib/es/*` into a Vite + React + Tailwind + Supabase project; do not rewrite the checker.

## SEO

- Unique title/description per city, guide, package and SKU
- JSON-LD LocalBusiness, FAQ, Product, Breadcrumb
- `/au/{city}` landing pages for every capital + Gold Coast / Sunshine Coast
- `public/sitemap.xml` + `public/robots.txt`

## Scripts

```bash
npm install
npm run dev      # 0.0.0.0:8080
npm run build
npm run typecheck
```
