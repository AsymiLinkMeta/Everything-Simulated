-- Remove Trak Racer names and photos from the catalogue (approved by Patrick, 4 Nov 2026:
-- "remove the Trak Racer names from the catalogue").
-- SKUs, slugs and ids are unchanged so URLs, carts, builder rules and orders keep working.
-- Order / quote / chat history is not touched.
--
-- Run:      psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/data/remove-trak-racer-names.sql
-- Rollback: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/data/remove-trak-racer-names-rollback.sql
begin;

-- 0. Text rewrite used below: Trak Racer chassis names -> the ES chassis name.
create or replace function pg_temp.es_rename(t text) returns text language sql immutable as $$
  select regexp_replace(regexp_replace(regexp_replace(regexp_replace(t,
    '(trak|track)[ -]?racer\s+tr120s(\s+v2)?', 'ES Pro 120', 'gi'),
    'tr120s(\s+v2)?', 'ES Pro 120', 'gi'),
    '(trak|track)[ -]?racer\s+tr80', 'ES Pro 80', 'gi'),
    '(trak|track)[ -]?racer', 'Everything Simulated', 'gi')
$$;
create or replace function pg_temp.es_rename_json(j jsonb) returns jsonb language sql immutable as $$
  select pg_temp.es_rename(j::text)::jsonb
$$;

-- 1. Backups of every row this script changes (kept until the redesign is signed off).
create table if not exists public._backup_20261104_trak_products as
  select * from public.catalog_products where sku in ('tr120s', 'side-mount', 'quad-mount', 'pc-starter');
create table if not exists public._backup_20261104_trak_prebuilds as
  select id, slug, blurb, description, specs, highlights from public.prebuilds
  where concat_ws(' ', blurb, description, specs::text, highlights::text) ~* '(trak|track)[ -]?racer|tr120';
create table if not exists public._backup_20261104_trak_rules as
  select * from public.compatibility_rules where reason ~* '(trak|track)[ -]?racer|tr120';
create table if not exists public._backup_20261104_trak_playbooks as
  select id, body from public.agent_playbooks where body ~* '(trak|track)[ -]?racer|tr120';
create table if not exists public._backup_20261104_trak_brands as
  select * from public.brands where name ~* '(trak|track)[ -]?racer' or link_url ~* 'trakracer';
revoke all on public._backup_20261104_trak_products, public._backup_20261104_trak_prebuilds,
  public._backup_20261104_trak_rules, public._backup_20261104_trak_playbooks, public._backup_20261104_trak_brands
  from anon, authenticated;
alter table public._backup_20261104_trak_products enable row level security;
alter table public._backup_20261104_trak_prebuilds enable row level security;
alter table public._backup_20261104_trak_rules enable row level security;
alter table public._backup_20261104_trak_playbooks enable row level security;
alter table public._backup_20261104_trak_brands enable row level security;

-- 2. Products (sku unchanged).
update public.catalog_products set
  name = 'ES Pro 120 Aluminium Chassis',
  brand = 'Everything Simulated',
  image = 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-cat-chassis.jpg',
  updated_at = now()
where sku = 'tr120s';

update public.catalog_products set
  name = 'Side Mount Kit',
  description = 'Simagic side-mount adapter kit for the ES Pro 120 chassis.',
  notes = 'Required when mounting Alpha EVO on the ES Pro 120 chassis.',
  updated_at = now()
where sku = 'side-mount';

update public.catalog_products set notes = pg_temp.es_rename(notes), updated_at = now()
where sku = 'quad-mount' and notes ~* 'tr120';

-- The Starter PC card used the Trak Racer rig photo; give it the ES studio PC render.
update public.catalog_products set
  image = 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-cat-pc.jpg',
  updated_at = now()
where sku = 'pc-starter' and image = '/rigs/starter.jpg';

-- 3. Prebuilds (Starter plus the archived Flagship Rival): same wording, ES chassis name.
update public.prebuilds set
  blurb = pg_temp.es_rename(blurb),
  description = pg_temp.es_rename(description),
  specs = pg_temp.es_rename_json(specs),
  highlights = pg_temp.es_rename_json(highlights),
  updated_at = now()
where id in (select id from public._backup_20261104_trak_prebuilds);

-- 4. Builder compatibility rule wording (ids and SKUs unchanged).
update public.compatibility_rules set reason = pg_temp.es_rename(reason)
where id in (select id from public._backup_20261104_trak_rules);

-- 5. Staff/assistant playbooks, so the assistant uses the ES name with customers.
update public.agent_playbooks set body = pg_temp.es_rename(body)
where id in (select id from public._backup_20261104_trak_playbooks);

-- 6. The "Track Racer" brand tile (brands has no visibility flag and nothing references it).
delete from public.brands where id in (select id from public._backup_20261104_trak_brands);

-- Sanity: nothing customer-facing still names Trak Racer / TR120S.
do $$ begin
  if exists (select 1 from public.catalog_products
             where concat_ws(' ', name, brand, description, notes, compare, mount_compatibility) ~* '(trak|track)[ -]?racer|tr120') then
    raise exception 'catalog_products still mentions Trak Racer';
  end if;
  if exists (select 1 from public.prebuilds
             where concat_ws(' ', name, blurb, description, specs::text, highlights::text) ~* '(trak|track)[ -]?racer|tr120') then
    raise exception 'prebuilds still mention Trak Racer';
  end if;
  if exists (select 1 from public.brands where name ~* '(trak|track)[ -]?racer') then
    raise exception 'brands still has Trak Racer';
  end if;
end $$;

commit;
