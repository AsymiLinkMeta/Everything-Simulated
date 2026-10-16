# Deploying Everything Simulated

Today `everythingsimulated.com.au` 301-redirects to `www.everythingsimulated.com.au`, which is
served by **Wix**. This repo is not live yet. This guide covers a staging deploy, the production
cutover from Wix, and rollback.

Everything below that touches a dashboard (Supabase, Stripe, Resend, Netlify, DNS, Wix) is a
manual step for the owner. Nothing in this repo changes those systems.

---

## 0. Prerequisites

- A Supabase project for **staging** and one for **production** (or one project to start, with
  the understanding that staging data is then real data).
- A static host. These instructions use **Netlify** because `public/_redirects`,
  `public/_headers` and `netlify.toml` are already in Netlify's format (Cloudflare Pages reads
  the same `_redirects`/`_headers` files).
- Optional: Stripe account, Resend account with `everythingsimulated.com.au` verified, xAI key.
- Supabase CLI and Deno for function deploys: `npm i -g supabase`, https://deno.land.

All variables are documented in [docs/ENV.md](docs/ENV.md).

## 1. Database

```bash
supabase link --project-ref <staging-ref>
supabase db push            # applies supabase/migrations/* in order
```

Migrations replay cleanly on an empty database (verified with `npm run test:db`, which also
runs the RLS/admin security checks). For an **existing** project whose schema was created before the CLI tracked it,
`supabase db push` only applies versions it has not recorded. Check first:

```bash
supabase migration list     # compare local vs remote versions
```

Then create the first admin (see docs/ENV.md, "Admin bootstrap"):

```sql
insert into public.admin_bootstrap_emails (email) values ('owner@everythingsimulated.com.au');
```

Dashboard settings:

- **Authentication → Providers → Email:** Confirm email = **on**.
- **Authentication → URL Configuration:** Site URL = your `SITE_URL`; add the staging URL and
  `http://localhost:5173` to Redirect URLs.

## 2. Edge Functions

```bash
cp supabase/functions/.env.example supabase/functions/.env   # fill in; never commit it
supabase secrets set --env-file supabase/functions/.env
supabase functions deploy                                      # deploys all functions
```

Functions: `generate-product-listing` (uses `XAI_API_KEY` for listing copy, falls back to a local draft),
`discover-products` (reads official Shopify/HTML catalogues), `ask-builder`, `create-staff-account`
(needs `SUPABASE_SERVICE_ROLE_KEY`), `send-mail`, `create-checkout-session`, `stripe-webhook`,
`refund-payment` and `billing-config`. At minimum set `SITE_URL` and `ALLOWED_ORIGINS` (add your preview
origin while developing), or browser calls get 403.

`verify_jwt` per function is set in `supabase/config.toml`. `send-mail`, `stripe-webhook`,
`create-checkout-session` and `billing-config` authenticate in code (see the comments there).

### Stripe (optional, card deposits)

1. Set `STRIPE_SECRET_KEY` (test key on staging).
2. Stripe Dashboard → Developers → Webhooks → Add endpoint
   `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`
   with events `checkout.session.completed` and `charge.refunded`.
3. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`, and set `INTERNAL_FUNCTION_SECRET`.
4. Test: `stripe trigger checkout.session.completed` and check the function log.
   Without `STRIPE_WEBHOOK_SECRET` the endpoint returns 500 on purpose.

## 3. Staging site

1. Netlify → Add new site → Import from GitHub → this repo. Build settings come from
   `netlify.toml` (`npm run build`, publish `dist`, Node 22).
2. Site environment variables:
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (staging project),
   `VITE_SITE_URL=https://<staging-host>`, `VITE_NOINDEX=true`.
3. Add the staging origin to `ALLOWED_ORIGINS` on the staging Supabase functions.
4. Deploy, then run the checklist in section 5.

Deploy previews and branch deploys get `VITE_NOINDEX=true` automatically.

## 4. Production cutover from Wix

### 4.1 Before DNS changes (no customer impact)

1. Create the production Netlify site with `VITE_SITE_URL=https://www.everythingsimulated.com.au`
   and **no** `VITE_NOINDEX`. Production Supabase keys.
2. Set function secrets on production Supabase: `SITE_URL=https://www.everythingsimulated.com.au`.
3. Run the section 5 checklist against the `*.netlify.app` URL.
4. Export anything you need from Wix: blog posts (Wix → Blog → export), contact-form
   submissions, bookings, member list. The Wix blog has no equivalent page in this app;
   the 301 map below sends those URLs to `/guides`. Port any post worth keeping into
   `GUIDES` in `src/lib/es/catalog.ts` before cutover.
5. Lower the TTL on the `www` and apex DNS records to 300 s a day ahead.

### 4.2 Redirect map (already in `public/_redirects`)

| Wix URL | New URL | Why |
| --- | --- | --- |
| `/about` (titled "Build Packages") | `/prebuilds` | Packages page |
| `/technology` ("Our Rigs") | `/racing` | Rig range |
| `/blank` ("Showroom") | `/studio` | Gold Coast studio |
| `/blank-2` ("News") | `/guides` | Closest content hub |
| `/book-online` | `/studio` | Studio demo booking |
| `/blog`, `/blog/*` | `/guides` | Blog → guides |
| `/post`, `/post/*` | `/guides` | Wix blog post URLs (`/post` 404s on Wix today) |
| `/terms-and-coniditions` | `/terms` | Typo slug |
| `/privacy-policy` | `/privacy` | |
| `/contact` | `/contact` | Same path, no rule needed |
| `https://everythingsimulated.com.au/*` | `https://www.everythingsimulated.com.au/:splat` | Canonical host |

All are permanent (301). `tests/site-seo.test.ts` fails if any is removed or if the SPA
fallback is not last.

### 4.3 Switch

1. Netlify → Domain management → add `www.everythingsimulated.com.au` (primary) and
   `everythingsimulated.com.au` (redirects to primary). Netlify issues the TLS certificate.
2. At the DNS provider (currently pointed at Wix): set `www` CNAME → `<site>.netlify.app`
   and the apex to Netlify's load balancer (ALIAS/ANAME or `75.2.60.5`). If the domain is
   registered **through Wix**, either transfer it out first or change the records in Wix → Domains.
3. Keep the Wix site published (unchanged) until DNS has propagated, then downgrade the plan.
   Don't delete it for at least 30 days.

### 4.4 After the switch

- Google Search Console: verify `https://www.everythingsimulated.com.au`, submit
  `/sitemap.xml`, and use URL Inspection on `/`, `/racing`, `/prebuilds/haptic`.
- Spot-check every row of the redirect map with
  `curl -sI https://www.everythingsimulated.com.au/about | grep -i location`.
- Watch Search Console coverage and 404s for two weeks; add `_redirects` rules for any
  Wix URL that still gets traffic.
- Update the Google Business Profile, Instagram and Facebook links if they point at Wix-only paths.

### Rollback

Point the DNS records back to Wix (the old values are in the provider's history). With a 300 s
TTL this takes effect within minutes. The Wix site is untouched by this process.

## 5. Release checklist (staging, then production)

- [ ] `npm run ci` passes locally (typecheck, lint, tests, build). CI runs the same plus `test:db` and `check:functions`.
- [ ] Home, `/racing`, `/prebuilds/haptic`, `/shop`, `/compatibility`, `/au/brisbane` render; view source shows the right canonical host.
- [ ] `/robots.txt`: Disallow-all on staging, full rules on production.
- [ ] Sign up → confirmation email arrives → sign in → lands in `/app`.
- [ ] The allowlisted owner signs in → sees `/staff`.
- [ ] Guest checkout → order appears in Staff → OMS → "placed" email (or `mail_log` row with `skipped`).
- [ ] With Stripe test keys: pay a deposit → webhook marks the order paid once (replaying the event in Stripe does nothing) → receipt email.
- [ ] `curl -sI` every row in the redirect map returns `301` and the right `location`.
- [ ] A cross-origin call from an unlisted origin to a function returns 403.
