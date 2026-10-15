# Environment variables

There are two places configuration lives:

1. **Frontend build** (Netlify / Bolt / Vercel env, or `.env.local` for dev). Only `VITE_*`
   variables are read, and every one of them ends up in the public JS bundle. **Never put a
   secret in a `VITE_*` variable.** Template: [`.env.example`](../.env.example).
2. **Supabase Edge Function secrets** (`supabase secrets set ...` or Dashboard → Edge Functions
   → Secrets). Template: [`supabase/functions/.env.example`](../supabase/functions/.env.example).

## Frontend (build time)

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | yes | — | Supabase project URL. |
| `VITE_SUPABASE_ANON_KEY` | yes | — | Supabase anon (public) key. Safe to expose; RLS protects data. |
| `VITE_SITE_URL` | no | `https://www.everythingsimulated.com.au` | The one public origin used for canonicals, OG/Twitter tags, JSON-LD, `sitemap.xml`, `robots.txt` and `llms.txt` (rewritten at build time). |
| `VITE_NOINDEX` | no | `false` | `true` on staging/previews: `noindex,nofollow` on every page and a `Disallow: /` robots.txt. |

## Edge Functions (runtime secrets)

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by
Supabase. Do not set them by hand.

| Variable | Used by | Required | Purpose |
| --- | --- | --- | --- |
| `SITE_URL` | create-checkout-session, send-mail, CORS | **yes** | Public origin. Stripe return URLs and links in emails are always built from this, never from the request. Must be `https://`. |
| `ALLOWED_ORIGINS` | every browser-facing function | recommended | Comma-separated extra origins allowed by CORS (staging, Bolt preview, `http://localhost:5173`). `SITE_URL` is always allowed. Browser calls from any other origin get 403. |
| `INTERNAL_FUNCTION_SECRET` | stripe-webhook → send-mail | yes, if Stripe is on | Shared secret in the `X-Internal-Secret` header. Generate with `openssl rand -hex 32`. Without it, payment receipts are not emailed. |
| `STRIPE_SECRET_KEY` | create-checkout-session, refund-payment, billing-config | for card payments | Empty means card payments stay off and checkout uses the quote/deposit-invoice flow. |
| `STRIPE_WEBHOOK_SECRET` | stripe-webhook | **yes, if Stripe is on** | Endpoint signing secret (`whsec_...`). Without it the webhook refuses every event (fails closed). |
| `STRIPE_WEBHOOK_TOLERANCE_SECONDS` | stripe-webhook | no (300) | Maximum age of a signed event. |
| `DEPOSIT_PERCENT` | create-checkout-session, billing-config | no (30) | Deposit percentage, 1–100. Minimum deposit is $500, capped at the order total. |
| `RESEND_API_KEY` | send-mail, billing-config | for email | Without it mail is recorded in `public.mail_log` with status `skipped`. |
| `MAIL_FROM` | send-mail | no | Sender, default `Everything Simulated <hello@everythingsimulated.com.au>`. The domain must be verified in Resend. |
| `STAFF_INBOX` | send-mail | no | Where staff copies go, default `hello@everythingsimulated.com.au`. |
| `XAI_API_KEY` | generate-product-listing, generate-prebuild, ask-builder | optional | AI-drafted copy. Without it, functions fall back to local drafts. |

## Admin bootstrap

The first account to sign up **no longer** becomes admin (anyone could have claimed it). Admins
are created explicitly, from the Supabase SQL editor:

```sql
-- Option A: allowlist an email. The account becomes admin the next time it signs in,
-- but only once that email is verified.
insert into public.admin_bootstrap_emails (email, note)
values ('owner@everythingsimulated.com.au', 'Owner');

-- Option B: promote an account that already exists.
select public.promote_admin('owner@everythingsimulated.com.au');
```

Neither the table nor `promote_admin()` is reachable through the public API. After that, admins
manage everyone else from **Staff → Team**. The last admin can never be demoted.

## Email confirmation

Migration `20261014000000_security_hardening.sql` removes the trigger that auto-confirmed every
sign-up. Also make sure **Authentication → Providers → Email → Confirm email** is **on** in the
Supabase dashboard, and set **Authentication → URL Configuration → Site URL** to `SITE_URL` with
your staging URL in the redirect allowlist.
