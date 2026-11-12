-- Photoreal / accuracy pass (2026-11-12).
-- APPLIED TO PROD 2026-11-12 16:43 America/New_York (wejllrdvkufsdxcfwwvl).
-- History row: supabase_migrations.schema_migrations version=20261112164349
--   name=photoreal_art_pr1 created_by='grokbot-manual-apply'.
-- Do NOT re-apply. Rollback: photoreal-art-pr1-rollback.sql
--   or /workspace/backups/photoreal-pr1-20261112-164349/rollback-from-files.sql
-- Filesystem backup: /workspace/backups/photoreal-pr1-20261112-164349/
--
-- New storage objects only (es-*-pr1.jpg and WebP twins); existing r1/r2/live files
-- were left untouched. This script updates site_media fallbacks, category art
-- (category:pc left on es-part-pc-r1.jpg), and the motion prebuild gallery.
-- Starter and haptic galleries were left alone until those prebuilds are re-rendered.
--
-- The home hero (/rigs/es-hero-wide.jpg) is a static STAGE_IMAGES asset, not site_media.
-- Pointing it at /rigs/es-hero-wide-pr1.jpg is a code change on feat/photoreal-pipeline
-- and goes live only when that PR is merged (needs Patrick's "release").
--
-- Run (already applied): psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/data/photoreal-art-pr1.sql
-- Rollback:              psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/data/photoreal-art-pr1-rollback.sql

begin;

create table if not exists public._backup_20261112_photoreal_media as
  select key, url, alt, width, height, sort, now() as backed_up_at
  from public.site_media
  where key in (
    'fallback:product', 'fallback:prebuild',
    'category:chassis', 'category:seat', 'category:wheel', 'category:wheelbase',
    'category:pedals', 'category:monitor', 'category:mount', 'category:motion',
    'category:shifter', 'category:handbrake', 'category:pc'
  );
revoke all on public._backup_20261112_photoreal_media from anon, authenticated;
alter table public._backup_20261112_photoreal_media enable row level security;

create table if not exists public._backup_20261112_photoreal_prebuilds as
  select id, slug, image, gallery, now() as backed_up_at
  from public.prebuilds where slug in ('motion');
revoke all on public._backup_20261112_photoreal_prebuilds from anon, authenticated;
alter table public._backup_20261112_photoreal_prebuilds enable row level security;

-- Fallbacks (product / prebuild pages that have no photo of their own)
update public.site_media set
  url = 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-hero-wide-pr1.jpg',
  width = 2400, height = 1350, updated_at = now()
where key in ('fallback:product', 'fallback:prebuild');

-- Category / part art (square pr1)
update public.site_media set url = 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-part-chassis-pr1.jpg', width = 1200, height = 1200, updated_at = now() where key = 'category:chassis';
update public.site_media set url = 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-part-seat-pr1.jpg',     width = 1200, height = 1200, updated_at = now() where key = 'category:seat';
update public.site_media set url = 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-part-wheel-pr1.jpg',    width = 1200, height = 1200, updated_at = now() where key in ('category:wheel', 'category:wheelbase');
update public.site_media set url = 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-part-pedals-pr1.jpg',   width = 1200, height = 1200, updated_at = now() where key = 'category:pedals';
update public.site_media set url = 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-part-screens-pr1.jpg',  width = 1200, height = 1200, updated_at = now() where key in ('category:monitor', 'category:mount');
update public.site_media set url = 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-part-motion-pr1.jpg',   width = 1200, height = 1200, updated_at = now() where key = 'category:motion';
update public.site_media set url = 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-part-shifter-pr1.jpg',  width = 1200, height = 1200, updated_at = now() where key in ('category:shifter', 'category:handbrake');
-- category:pc is left on es-part-pc-r1.jpg until a new PC render ships in a later pass

update public.prebuilds set
  image = 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-prebuild-motion-1-pr1.jpg',
  gallery = jsonb_build_array(
    'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-prebuild-motion-1-pr1.jpg',
    'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-prebuild-motion-2-pr1.jpg',
    'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-prebuild-motion-3-pr1.jpg',
    'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-prebuild-motion-4-pr1.jpg'
  )
where slug = 'motion';

do $$ begin
  if (select count(*) from public.site_media where url like '%-pr1.jpg') < 10 then
    raise exception 'photoreal art not updated (expected >= 10 site_media rows on -pr1)';
  end if;
  if (select image from public.prebuilds where slug = 'motion') not like '%es-prebuild-motion-1-pr1.jpg' then
    raise exception 'motion prebuild image not updated';
  end if;
  if (select jsonb_array_length(gallery) from public.prebuilds where slug = 'motion') <> 4 then
    raise exception 'motion gallery not 4 items';
  end if;
end $$;

commit;
