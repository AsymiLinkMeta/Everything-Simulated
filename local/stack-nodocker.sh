#!/usr/bin/env bash
# Docker-free variant of local/stack.sh for boxes without Docker (and for when CI can't run).
# Downloads static binaries into $NODOCKER_DIR (default /tmp/es-stack): Postgres 17 (embedded-postgres
# npm build), GoTrue, PostgREST and Mailpit, then starts them on the same ports as stack.sh.
# No Storage API: storage.buckets/objects are plain tables (see nodocker-init.sql), so photo-upload
# tests fail here; everything else runs. Then: local/migrate.sh, gateway, local/seed.sh as in CI.
#   local/stack-nodocker.sh up | down
set -euo pipefail
cd "$(dirname "$0")"
source ./stack.env
D=${NODOCKER_DIR:-/tmp/es-stack}
mkdir -p "$D"
if [[ "${1:-up}" == down ]]; then
  pkill -f "$D/(auth|postgrest|mailpit)" || true
  [[ -d "$D/pgdata" ]] && LD_LIBRARY_PATH="$D/pg/lib" "$D/pg/bin/pg_ctl" -D "$D/pgdata" stop -m fast || true
  exit 0
fi
if [[ ! -x "$D/pg/bin/postgres" ]]; then
  (cd "$D" && npm init -y >/dev/null && npm i -s @embedded-postgres/linux-x64@17.5.0-beta.15 >/dev/null)
  ln -sfn "$D/node_modules/@embedded-postgres/linux-x64/native" "$D/pg"; chmod +x "$D"/pg/bin/*
fi
[[ -x "$D/auth" ]] || (cd "$D" && gh release download v2.197.0 -R supabase/auth -p 'auth-v2.197.0-x86.tar.gz' --clobber && tar xzf auth-v2.197.0-x86.tar.gz)
[[ -x "$D/postgrest" ]] || (cd "$D" && gh release download v16.4 -R PostgREST/postgrest -p '*linux-static-x86-64*' --clobber && tar xJf postgrest-v16.4-linux-static-x86-64.tar.xz)
[[ -x "$D/mailpit" ]] || (cd "$D" && gh release download v1.31.3 -R axllent/mailpit -p 'mailpit-linux-amd64.tar.gz' --clobber && tar xzf mailpit-linux-amd64.tar.gz mailpit)
pg() { LD_LIBRARY_PATH="$D/pg/lib" "$@"; }
if [[ ! -d "$D/pgdata" ]]; then
  pg "$D/pg/bin/initdb" -D "$D/pgdata" -U postgres --auth=trust >/dev/null
  echo "listen_addresses='127.0.0.1'" >> "$D/pgdata/postgresql.conf"
  pg "$D/pg/bin/pg_ctl" -D "$D/pgdata" -o "-p 54322 -k /tmp" -l "$D/pg.log" start >/dev/null; sleep 2
  psql postgres://postgres@127.0.0.1:54322/postgres -q -v ON_ERROR_STOP=1 -f nodocker-init.sql
else
  pg "$D/pg/bin/pg_ctl" -D "$D/pgdata" -o "-p 54322 -k /tmp" -l "$D/pg.log" start >/dev/null || true; sleep 2
fi
(cd "$D" && nohup ./mailpit --listen 127.0.0.1:54324 --smtp 127.0.0.1:54325 > mail.log 2>&1 &)
(
  cd "$D"
  export GOTRUE_API_HOST=127.0.0.1 GOTRUE_API_PORT=54331 API_EXTERNAL_URL=http://localhost:54321/auth/v1
  export GOTRUE_DB_DRIVER=postgres GOTRUE_DB_DATABASE_URL=postgres://supabase_auth_admin:postgres@127.0.0.1:54322/postgres
  export GOTRUE_DB_MIGRATIONS_PATH="$D/migrations" GOTRUE_SITE_URL=http://localhost:5173
  export "GOTRUE_URI_ALLOW_LIST=http://localhost:5173/**,http://127.0.0.1:5173/**,http://localhost:4173/**"
  export GOTRUE_DISABLE_SIGNUP=false GOTRUE_JWT_SECRET="$JWT_SECRET" GOTRUE_JWT_EXP=3600 GOTRUE_JWT_AUD=authenticated
  export GOTRUE_JWT_ADMIN_ROLES=service_role GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated
  export GOTRUE_EXTERNAL_EMAIL_ENABLED=true GOTRUE_MAILER_AUTOCONFIRM=false
  export GOTRUE_SMTP_HOST=127.0.0.1 GOTRUE_SMTP_PORT=54325 GOTRUE_SMTP_ADMIN_EMAIL=noreply@everythingsimulated.local
  export "GOTRUE_SMTP_SENDER_NAME=Everything Simulated" GOTRUE_MAILER_URLPATHS_CONFIRMATION=/auth/v1/verify
  export GOTRUE_RATE_LIMIT_EMAIL_SENT=10000 GOTRUE_SMTP_MAX_FREQUENCY=1s
  ./auth migrate >/dev/null 2>&1
  nohup ./auth serve > auth.log 2>&1 &
  export PGRST_DB_URI=postgres://authenticator:postgres@127.0.0.1:54322/postgres PGRST_DB_SCHEMAS=public
  export PGRST_DB_ANON_ROLE=anon PGRST_JWT_SECRET="$JWT_SECRET" PGRST_DB_USE_LEGACY_GUCS=false PGRST_SERVER_PORT=54332
  nohup ./postgrest > rest.log 2>&1 &
)
sleep 3
echo "stack up (no Docker; no Storage API)"
