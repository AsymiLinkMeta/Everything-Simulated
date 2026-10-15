#!/usr/bin/env bash
# Replay every migration on an empty Supabase Postgres, then run the security tests.
#
# Usage:
#   ADMIN_URL=postgres://supabase_admin:postgres@127.0.0.1:54329/postgres \
#   DB_URL=postgres://postgres:postgres@127.0.0.1:54329/postgres \
#   npm run test:db
#
# Without env vars it starts a throwaway container from the same image Supabase uses
# (needs Docker) and removes it afterwards.
set -euo pipefail
cd "$(dirname "$0")/.."

IMAGE="${SUPABASE_PG_IMAGE:-public.ecr.aws/supabase/postgres:17.11.0.004}"
CONTAINER=""
cleanup() { [[ -n "$CONTAINER" ]] && docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT

if [[ -z "${DB_URL:-}" ]]; then
  PORT="${PG_PORT:-54329}"
  CONTAINER="es-db-test-$$"
  docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=postgres -p "$PORT:5432" "$IMAGE" >/dev/null
  DB_URL="postgres://postgres:postgres@127.0.0.1:$PORT/postgres"
  ADMIN_URL="postgres://supabase_admin:postgres@127.0.0.1:$PORT/postgres"
  echo "Waiting for Postgres in $CONTAINER..."
  for _ in $(seq 1 60); do
    if psql "$DB_URL" -qtAc "select 1 from information_schema.tables where table_schema = 'auth' and table_name = 'users'" 2>/dev/null | grep -q 1; then break; fi
    sleep 2
  done
  sleep 3 # the image restarts Postgres once after its init scripts
fi
ADMIN_URL="${ADMIN_URL:-$DB_URL}"

echo "Applying auth shim (test only)"
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -q -f supabase/tests/auth-shim.sql

count=0
for f in $(ls supabase/migrations/*.sql | sort); do
  if ! out=$(psql "$DB_URL" -v ON_ERROR_STOP=1 -q -1 -f "$f" 2>&1); then
    echo "FAILED: $f"; echo "$out" | grep -v NOTICE | head -20; exit 1
  fi
  count=$((count + 1))
done
echo "Applied $count migrations in order"

out=$(psql "$DB_URL" -v ON_ERROR_STOP=1 -qtA -f supabase/tests/security.test.sql 2>&1) || { echo "$out" | grep -v '^$'; exit 1; }
echo "$out" | grep -E "ok -|FAILED" | sed 's/^.*NOTICE:  /  /'
echo "Database security tests passed"
