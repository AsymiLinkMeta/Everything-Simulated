#!/usr/bin/env bash
# Seed the local stack: catalogue data copied read-only from prod (anonymised, no customer
# records; see catalog-snapshot.json) plus synthetic accounts and demo records.
# Accounts (password for all: Passw0rd!local):
#   admin@es.local (admin) · staff@es.local (sales) · customer@es.local (customer)
#   driver@es.local (customer linked to the seeded ambassador)
set -euo pipefail
cd "$(dirname "$0")"
source ./stack.env
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
CREATE TEMP TABLE _snap AS SELECT :'snap'::json AS j;
-- Insert only the columns the snapshot has, so columns added by newer
-- migrations keep their defaults (the snapshot is older than the schema).
DO \$\$
DECLARE t text; cols text;
BEGIN
  FOREACH t IN ARRAY ARRAY['brands','catalog_products','prebuilds','prebuild_components','product_overrides','ambassadors'] LOOP
    SELECT string_agg(quote_ident(k), ', ') INTO cols
      FROM json_object_keys((SELECT j->t->0 FROM _snap)) k
     WHERE EXISTS (SELECT 1 FROM information_schema.columns c
                    WHERE c.table_schema = 'public' AND c.table_name = t AND c.column_name = k);
    EXECUTE format('INSERT INTO public.%I (%s) SELECT %s FROM json_populate_recordset(null::public.%I, (SELECT j->%L FROM _snap))',
                   t, cols, cols, t, t);
  END LOOP;
END \$\$;
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

# The snapshot is prod data from before the pricing migration. Re-apply it
# (it is idempotent) so its data fixes run on the seeded rows, as they will on prod.
psql "$DB" -q -1 -v ON_ERROR_STOP=1 -f ../supabase/migrations/20261015130000_server_pricing.sql 2>&1 | grep -v NOTICE || true
psql "$DB" -q -1 -v ON_ERROR_STOP=1 -f ../supabase/migrations/20261016090000_ambassador_program.sql 2>&1 | grep -v NOTICE || true
psql "$DB" -q -1 -v ON_ERROR_STOP=1 -f ../supabase/migrations/20261017090000_prebuild_price_source.sql 2>&1 | grep -v NOTICE || true
psql "$DB" -qtAc "notify pgrst, 'reload schema'" >/dev/null
echo "seeded: $(psql "$DB" -qtAc "select count(*) from catalog_products") products, $(psql "$DB" -qtAc "select count(*) from prebuilds") prebuilds, $(psql "$DB" -qtAc "select count(*) from profiles") profiles"
