# Local full stack

Everything runs on your machine, with no Supabase project, Stripe account or AI key needed.

| Piece | How | URL |
| --- | --- | --- |
| Postgres (Supabase image) | `local/stack.sh` | `postgres://postgres:postgres@127.0.0.1:54322/postgres` |
| Auth (GoTrue, email confirmation **on**) | `local/stack.sh` | via gateway `/auth/v1` |
| REST (PostgREST) | `local/stack.sh` | via gateway `/rest/v1` |
| Mail catcher (Mailpit) | `local/stack.sh` | http://localhost:54324 |
| Edge functions + API gateway | `local/gateway.ts` | http://localhost:54321 |
| Stripe (test-mode mock, signed webhooks) | inside the gateway | `/__mock/stripe/checkout/<session>` |
| xAI / Resend | mocked inside the gateway | `/__mock/ai`, `/__mock/mail` |

```bash
local/stack.sh up          # first run pulls images; `reset` wipes the database
local/migrate.sh           # all supabase/migrations in order
local/seed.sh              # catalogue copied (read-only, anonymised) from prod + demo accounts
deno run -A --node-modules-dir=none local/gateway.ts &
source local/.env.local-stack && LOCAL_ANON_KEY=$ANON_KEY npm run e2e
```

Demo accounts (password `Passw0rd!local`): `admin@es.local`, `staff@es.local` (sales),
`customer@es.local`, `driver@es.local` (linked to the seeded ambassador).

The gateway loads each `supabase/functions/*/index.ts` in-process, enforces `verify_jwt`
from `supabase/config.toml`, and replaces outbound calls to `api.stripe.com`, `api.resend.com`
and `api.x.ai` with mocks. Paying on the mock checkout sends a **signed**
`checkout.session.completed` event to the real `stripe-webhook` function, exactly as Stripe does.
`POST /__mock/stripe/event {type, object}` sends any other signed event (for example `charge.refunded`).

`local/.env.local-stack` holds throwaway keys signed with a local-only secret. They are not credentials.

Why not `supabase start`? On hosts where container-to-container networking is unreliable,
the CLI's realtime migration step times out. This stack only needs published ports, so it works there too.
