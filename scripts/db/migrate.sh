#!/usr/bin/env bash
# Aplica as migrações de supabase/migrations/ que ainda não rodaram, em ordem, direto no Postgres do Supabase.
# Usa DATABASE_URL (Supabase → Project Settings → Database → Connection string, modo "Session").
# Cada arquivo roda numa transação (tudo ou nada) e fica registrado em public.mk_schema_migrations.
set -euo pipefail
cd "$(dirname "$0")/../.."
: "${DATABASE_URL:?defina DATABASE_URL no .env.server}"
PSQL=(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -X)
"${PSQL[@]}" -c "create table if not exists public.mk_schema_migrations (name text primary key, applied_at timestamptz not null default now()); alter table public.mk_schema_migrations enable row level security;"
for f in supabase/migrations/*.sql; do
  name="$(basename "$f")"
  done_=$("${PSQL[@]}" -tA -c "select 1 from public.mk_schema_migrations where name = '$name'")
  if [ "$done_" = "1" ]; then echo "ok (já aplicada) $name"; continue; fi
  echo "aplicando $name ..."
  "${PSQL[@]}" -1 -f "$f"
  "${PSQL[@]}" -c "insert into public.mk_schema_migrations (name) values ('$name')"
  echo "feito $name"
done
