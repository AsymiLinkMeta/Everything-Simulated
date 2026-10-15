#!/usr/bin/env bash
# Seed the local stack: catalogue data copied read-only from prod (anonymised, no customer
# records; see catalog-snapshot.json) plus synthetic accounts and demo records.
# Accounts (password for all: Passw0rd!local):
#   admin@es.local (admin) · staff@es.local (sales) · customer@es.local (customer)
#   driver@es.local (customer linked to the seeded ambassador)
set -euo pipefail
cd "$(dirname "$0")"
source ./.env.local-stack
DB=${LOCAL_DB_URL:-postgres://postgres:postgres@127.0.0.1:54322/postgres}
API=${LOCAL_API_URL:-http://localhost:54321}
PW='Passw0rd!local'

mkuser() {
  local email=$1
  curl -s -X POST "$API/auth/v1/admin/users" -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H 'content-type: application/json' -d "{\"email\":\"$email\",\"password\":\"$PW\",\"email_confirm\":true}" >/dev/null
}
for u in admin staff customer driver; do mkuser "$u@es.local"; done

psql "$DB" -v ON_ERROR_STOP=1 -q <<SQL
BEGIN;
SET session_replication_role = replica;  -- seed only: skip audit/alert triggers
TRUNCATE public.prebuild_components, public.prebuilds, public.product_overrides, public.catalog_products, public.brands, public.ambassadors CASCADE;
\set snap \`cat seed/catalog-snapshot.json\`
INSERT INTO public.brands SELECT * FROM json_populate_recordset(null::public.brands, (:'snap'::json)->'brands');
INSERT INTO public.catalog_products SELECT * FROM json_populate_recordset(null::public.catalog_products, (:'snap'::json)->'catalog_products');
INSERT INTO public.prebuilds SELECT * FROM json_populate_recordset(null::public.prebuilds, (:'snap'::json)->'prebuilds');
INSERT INTO public.prebuild_components SELECT * FROM json_populate_recordset(null::public.prebuild_components, (:'snap'::json)->'prebuild_components');
INSERT INTO public.product_overrides SELECT * FROM json_populate_recordset(null::public.product_overrides, (:'snap'::json)->'product_overrides');
INSERT INTO public.ambassadors SELECT * FROM json_populate_recordset(null::public.ambassadors, (:'snap'::json)->'ambassadors');
-- prod still has the long slugs until its catch-up migrations run; mirror the post-migration state
UPDATE public.prebuilds SET slug = 'starter' WHERE slug = 'starter-rig';
UPDATE public.prebuilds SET slug = 'haptic' WHERE slug = 'haptic-racing-simulator';
UPDATE public.prebuilds SET slug = 'motion' WHERE slug = 'motion-racing-simulator';

INSERT INTO public.profiles (user_id, email, display_name, role)
SELECT id::text, email, initcap(split_part(email, '@', 1)),
       CASE split_part(email, '@', 1) WHEN 'admin' THEN 'admin' WHEN 'staff' THEN 'sales' ELSE 'customer' END
FROM auth.users WHERE email LIKE '%@es.local'
ON CONFLICT (user_id) DO UPDATE SET role = excluded.role, email = excluded.email;
UPDATE public.ambassadors SET user_id = (SELECT id FROM auth.users WHERE email = 'driver@es.local');
COMMIT;
SQL
psql "$DB" -qtAc "notify pgrst, 'reload schema'" >/dev/null
echo "seeded: $(psql "$DB" -qtAc "select count(*) from catalog_products") products, $(psql "$DB" -qtAc "select count(*) from prebuilds") prebuilds, $(psql "$DB" -qtAc "select count(*) from profiles") profiles"
