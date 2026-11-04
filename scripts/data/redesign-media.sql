-- Redesign media data (run ONLY after approval, after migration 20261104182338 is applied).
-- Points the ES fallbacks, category art and the three published prebuilds at the ES studio
-- renders in Supabase Storage (public bucket product-images, folder site/), uploaded from
-- public/rigs/es-*.jpg. Absolute URLs so every deployed build (preview or production) can
-- load them; images live in data, the UI has no SKU -> image map.
-- Motion has one render so far; add es-prebuild-motion-2..4 to its gallery once rendered.
--
-- Run:      psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/data/redesign-media.sql
-- Rollback: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/data/redesign-media-rollback.sql
begin;

-- 1. Backup the rows this script changes (kept until the redesign is signed off).
create table if not exists public._backup_20261104_prebuild_media as
  select id, slug, image, gallery, now() as backed_up_at from public.prebuilds where slug in ('starter', 'haptic', 'motion');
revoke all on public._backup_20261104_prebuild_media from anon, authenticated;
alter table public._backup_20261104_prebuild_media enable row level security;

-- 2. Site-wide fallbacks and per-category art (shown when a product has no photo of its own).
insert into public.site_media (key, url, alt, width, height, sort) values
  ('fallback:product',    'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-hero-wide.jpg',     'Everything Simulated rig in the studio', 1600, 1200, 0),
  ('fallback:prebuild',   'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-hero-wide.jpg',     'Everything Simulated rig',     1600, 1200, 0),
  ('category:chassis',    'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-cat-chassis.jpg',   'Cockpit',      1600, 1200, 10),
  ('category:seat',       'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-cat-seat.jpg',      'Seat',         1600, 1200, 20),
  ('category:wheelbase',  'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-cat-wheel.jpg',     'Wheelbase',    1600, 1200, 30),
  ('category:wheel',      'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-cat-wheel.jpg',     'Wheel',        1600, 1200, 31),
  ('category:pedals',     'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-cat-pedals.jpg',    'Pedals',       1600, 1200, 40),
  ('category:monitor',    'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-cat-screens.jpg',   'Screens',      1600, 1200, 50),
  ('category:mount',      'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-cat-screens.jpg',   'Screen mount', 1600, 1200, 51),
  ('category:motion',     'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-cat-motion.jpg',    'Motion',       1600, 1200, 60),
  ('category:shifter',    'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-cat-shifter.jpg',   'Shifter',      1600, 1200, 70),
  ('category:handbrake',  'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-cat-shifter.jpg',   'Handbrake',    1600, 1200, 71),
  ('category:pc',         'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-cat-pc.jpg',        'Sim PC',       1600, 1200, 80)
on conflict (key) do update set url = excluded.url, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;

-- 3. Prebuild hero image + gallery (replaces the Starter's embedded third-party photo).
update public.prebuilds p set
  image = v.base || 'es-prebuild-' || p.slug || '-1.jpg',
  gallery = case p.slug
    when 'motion' then jsonb_build_array(v.base || 'es-prebuild-motion-1.jpg')
    else jsonb_build_array(
      v.base || 'es-prebuild-' || p.slug || '-1.jpg', v.base || 'es-prebuild-' || p.slug || '-2.jpg',
      v.base || 'es-prebuild-' || p.slug || '-3.jpg', v.base || 'es-prebuild-' || p.slug || '-4.jpg')
  end
from (select 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/'::text as base) v
where p.slug in ('starter', 'haptic', 'motion');

-- Sanity: exactly three prebuilds changed, no embedded images left on published rows.
do $$ begin
  if (select count(*) from public.prebuilds where slug in ('starter','haptic','motion') and image like '%/product-images/site/es-prebuild-%') <> 3 then
    raise exception 'expected 3 prebuild rows updated';
  end if;
  if exists (select 1 from public.prebuilds where status = 'published' and image like 'data:%') then
    raise exception 'a published prebuild still has an embedded image';
  end if;
end $$;

commit;
