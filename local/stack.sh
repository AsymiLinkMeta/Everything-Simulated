#!/usr/bin/env bash
# Local Supabase-compatible stack for development and e2e tests (no docker compose needed).
#   local/stack.sh up     start db, auth (GoTrue), rest (PostgREST), mail (Mailpit)
#   local/stack.sh reset  wipe the db volume and start again
#   local/stack.sh down   stop and remove everything
# Ports: Postgres 54322, GoTrue 54331, PostgREST 54332, Mailpit UI/API 54324.
# The API gateway (local/gateway.ts) serves all of it at http://localhost:54321.
set -euo pipefail
cd "$(dirname "$0")"
source ./stack.env
P=es-local
case "${1:-up}" in
  down|reset)
    docker rm -f $P-db $P-auth $P-rest $P-mail >/dev/null 2>&1 || true
    docker volume rm $P-db >/dev/null 2>&1 || true
    [[ "${1}" == down ]] && { exit 0; } ;;
esac
# Container-to-container DNS is unreliable on some Docker hosts (this box included), so the
# db and mail containers publish ports and auth/rest run on the host network.
# public.ecr.aws rate-limits anonymous pulls (CI hit "toomanyrequests"), so pull with backoff first.
pull() {
  local img=$1
  docker image inspect "$img" >/dev/null 2>&1 && return
  for i in 1 2 3 4 5 6; do
    docker pull -q "$img" >/dev/null && return
    echo "pull $img failed (attempt $i), retrying in $((i * 15))s" >&2; sleep $((i * 15))
  done
  docker pull "$img"
}
run() {
  local n=$1; shift
  docker inspect $P-$n >/dev/null 2>&1 && { docker start $P-$n >/dev/null; return; }
  pull "${@: -1}"
  docker run -d --name $P-$n "$@" >/dev/null
}
run db -v $P-db:/var/lib/postgresql/data -p 54322:5432 -e POSTGRES_PASSWORD=postgres -e JWT_SECRET="$JWT_SECRET" -e JWT_EXP=3600 public.ecr.aws/supabase/postgres:17.11.0.004
echo -n "waiting for db"
for _ in $(seq 1 90); do
  if PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -qtAc "select 1 from pg_roles where rolname='supabase_auth_admin'" 2>/dev/null | grep -q 1; then break; fi
  echo -n .; sleep 2
done; echo; sleep 4
# The bare image leaves service-role passwords unset; GoTrue and PostgREST log in with these.
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U supabase_admin -d postgres -qc \
  "alter role authenticator with password 'postgres'; alter role supabase_auth_admin with password 'postgres';" >/dev/null
run mail -p 54324:8025 -p 54325:1025 public.ecr.aws/supabase/mailpit:v1.31.3
run auth --network host --restart on-failure \
  -e GOTRUE_API_HOST=0.0.0.0 -e GOTRUE_API_PORT=54331 -e API_EXTERNAL_URL=http://localhost:54321/auth/v1 \
  -e GOTRUE_DB_DRIVER=postgres -e GOTRUE_DB_DATABASE_URL=postgres://supabase_auth_admin:postgres@127.0.0.1:54322/postgres \
  -e GOTRUE_SITE_URL=http://localhost:5173 -e "GOTRUE_URI_ALLOW_LIST=http://localhost:5173/**,http://127.0.0.1:5173/**,http://localhost:4173/**" \
  -e GOTRUE_DISABLE_SIGNUP=false -e GOTRUE_JWT_SECRET="$JWT_SECRET" -e GOTRUE_JWT_EXP=3600 -e GOTRUE_JWT_AUD=authenticated \
  -e GOTRUE_JWT_ADMIN_ROLES=service_role -e GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated \
  -e GOTRUE_EXTERNAL_EMAIL_ENABLED=true -e GOTRUE_MAILER_AUTOCONFIRM=false \
  -e GOTRUE_SMTP_HOST=127.0.0.1 -e GOTRUE_SMTP_PORT=54325 -e GOTRUE_SMTP_ADMIN_EMAIL=noreply@everythingsimulated.local \
  -e "GOTRUE_SMTP_SENDER_NAME=Everything Simulated" -e GOTRUE_MAILER_URLPATHS_CONFIRMATION=/auth/v1/verify \
  -e GOTRUE_RATE_LIMIT_EMAIL_SENT=10000 -e GOTRUE_SMTP_MAX_FREQUENCY=1s \
  public.ecr.aws/supabase/gotrue:v2.197.0
run rest --network host --restart on-failure \
  -e PGRST_DB_URI=postgres://authenticator:postgres@127.0.0.1:54322/postgres -e PGRST_DB_SCHEMAS=public \
  -e PGRST_DB_ANON_ROLE=anon -e PGRST_JWT_SECRET="$JWT_SECRET" -e PGRST_DB_USE_LEGACY_GUCS=false -e PGRST_SERVER_PORT=54332 \
  public.ecr.aws/supabase/postgrest:v16.4
echo "stack up"
