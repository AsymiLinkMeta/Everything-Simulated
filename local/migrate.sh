#!/usr/bin/env bash
# Apply every migration in supabase/migrations (in version order) to the local stack.
set -euo pipefail
cd "$(dirname "$0")/.."
DB=${LOCAL_DB_URL:-postgres://postgres:postgres@127.0.0.1:54322/postgres}
n=0
for f in $(ls supabase/migrations/*.sql | sort); do
  psql "$DB" -q -1 -v ON_ERROR_STOP=1 -f "$f" >/dev/null || { echo "FAILED: $f"; exit 1; }
  n=$((n + 1))
done
psql "$DB" -qtAc "notify pgrst, 'reload schema'" >/dev/null
echo "applied $n migrations"
