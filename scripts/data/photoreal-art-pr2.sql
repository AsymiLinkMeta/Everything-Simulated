-- Photoreal phase 2 (2026-11-12). NOT APPLIED. Do not apply until Patrick
-- approves the comparison sheets.
-- New storage objects only (es-*-pr2.jpg and WebP twins); existing r1/r2/pr1/live
-- files are untouched.
-- Rollback: photoreal-art-pr2-rollback.sql
--
-- Updates:
--   site_media category:seat, shifter, handbrake → improved weave / visible H-gate
--   site_media category:pc → rebuilt mid-tower
--   starter and haptic prebuild image + 4-item galleries
-- Leaves motion (already pr1), other category keys, and fallbacks alone.
-- Home hero-tall and wide cat-* heroes are STAGE_IMAGES (code on feat/photoreal-pipeline),
-- not site_media. Those go live only when that PR is merged (needs Patrick's "release").
--
-- Run:      psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/data/photoreal-art-pr2.sql
-- Rollback: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/data/photoreal-art-pr2-rollback.sql

begin;

create table if not exists public._backup_20261112_photoreal_pr2_media as
  select key, url, alt, width, height, sort, now() as backed_up_at
  from public.site_media
  where key in (
    'category:seat', 'category:shifter', 'category:handbrake', 'category:pc'
  );
revoke all on public._backup_20261112_photoreal_pr2_media from anon, authenticated;

create table if not exists public._backup_20261112_photoreal_pr2_prebuilds as
  select slug, image, gallery, now() as backed_up_at
  from public.prebuilds
  where slug in ('starter', 'haptic');
revoke all on public._backup_20261112_photoreal_pr2_prebuilds from anon, authenticated;

-- If this is a re-run, the backup tables already hold the pre-pr2 state; do not overwrite them.

update public.site_media set
  url = 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-part-seat-pr2.jpg',
  width = 1200, height = 1200, updated_at = now()
where key = 'category:seat';

update public.site_media set
  url = 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-part-shifter-pr2.jpg',
  width = 1200, height = 1200, updated_at = now()
where key in ('category:shifter', 'category:handbrake');

update public.site_media set
  url = 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-part-pc-pr2.jpg',
  width = 1200, height = 1200, updated_at = now()
where key = 'category:pc';

update public.prebuilds set
  image = 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-prebuild-starter-1-pr2.jpg',
  gallery = array[
    'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-prebuild-starter-1-pr2.jpg',
    'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-prebuild-starter-2-pr2.jpg',
    'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-prebuild-starter-3-pr2.jpg',
    'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-prebuild-starter-4-pr2.jpg'
  ],
  updated_at = now()
where slug = 'starter';

update public.prebuilds set
  image = 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-prebuild-haptic-1-pr2.jpg',
  gallery = array[
    'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-prebuild-haptic-1-pr2.jpg',
    'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-prebuild-haptic-2-pr2.jpg',
    'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-prebuild-haptic-3-pr2.jpg',
    'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-prebuild-haptic-4-pr2.jpg'
  ],
  updated_at = now()
where slug = 'haptic';

-- sanity: the four keys and both prebuilds now point at -pr2
do $$
declare
  n int;
  g int;
begin
  select count(*) into n from public.site_media
    where key in ('category:seat','category:shifter','category:handbrake','category:pc')
      and url like '%-pr2.jpg';
  if n < 4 then
    raise exception 'photoreal-art-pr2: expected 4 site_media keys on -pr2, got %', n;
  end if;
  select coalesce(array_length(gallery, 1), 0) into g from public.prebuilds where slug = 'starter';
  if g <> 4 then
    raise exception 'photoreal-art-pr2: starter gallery length %, expected 4', g;
  end if;
  select coalesce(array_length(gallery, 1), 0) into g from public.prebuilds where slug = 'haptic';
  if g <> 4 then
    raise exception 'photoreal-art-pr2: haptic gallery length %, expected 4', g;
  end if;
end $$;

commit;
