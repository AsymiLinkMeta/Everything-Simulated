-- Redesign media data (run ONLY after approval, after migration 20261104182338 is applied).
-- Points the ES fallbacks and the three published prebuilds at the committed ES studio
-- renders under /rigs/es-*. Images live in data; the UI has no SKU -> image map.
--
-- Run:      psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/data/redesign-media.sql
-- Rollback: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/data/redesign-media-rollback.sql
begin;

-- 1. Backup the rows this script changes (kept until the redesign is signed off).
create table if not exists public._backup_20261104_prebuild_media as
  select id, slug, image, gallery, now() as backed_up_at from public.prebuilds where slug in ('starter', 'haptic', 'motion');
revoke all on public._backup_20261104_prebuild_media from anon, authenticated;

-- 2. Site-wide fallbacks and per-category art (shown when a product has no photo of its own).
insert into public.site_media (key, url, alt, width, height, sort) values
  ('fallback:product',    '/rigs/es-plate.jpg',        'Everything Simulated studio', 1600, 1200, 0),
  ('fallback:prebuild',   '/rigs/es-cat-chassis.jpg',  'Everything Simulated rig',    1600, 1200, 0),
  ('category:chassis',    '/rigs/es-part-chassis.jpg', 'Cockpit',     1600, 1200, 10),
  ('category:seat',       '/rigs/es-part-seat.jpg',    'Seat',        1600, 1200, 20),
  ('category:wheelbase',  '/rigs/es-part-wheel.jpg',   'Wheelbase',   1600, 1200, 30),
  ('category:wheel',      '/rigs/es-part-wheel.jpg',   'Wheel',       1600, 1200, 31),
  ('category:pedals',     '/rigs/es-part-pedals.jpg',  'Pedals',      1600, 1200, 40),
  ('category:monitor',    '/rigs/es-part-screens.jpg', 'Screens',     1600, 1200, 50),
  ('category:mount',      '/rigs/es-part-screens.jpg', 'Screen mount',1600, 1200, 51),
  ('category:motion',     '/rigs/es-part-motion.jpg',  'Motion',      1600, 1200, 60),
  ('category:shifter',    '/rigs/es-part-shifter.jpg', 'Shifter',     1600, 1200, 70),
  ('category:handbrake',  '/rigs/es-part-shifter.jpg', 'Handbrake',   1600, 1200, 71),
  ('category:pc',         '/rigs/es-part-pc.jpg',      'Sim PC',      1600, 1200, 80)
on conflict (key) do update set url = excluded.url, alt = excluded.alt, width = excluded.width, height = excluded.height, sort = excluded.sort;

-- 3. Prebuild hero image + gallery (replaces the Starter's embedded third-party photo).
update public.prebuilds set
  image = '/rigs/es-prebuild-' || slug || '-1.jpg',
  gallery = jsonb_build_array(
    '/rigs/es-prebuild-' || slug || '-1.jpg', '/rigs/es-prebuild-' || slug || '-2.jpg',
    '/rigs/es-prebuild-' || slug || '-3.jpg', '/rigs/es-prebuild-' || slug || '-4.jpg')
where slug in ('starter', 'haptic', 'motion');

-- Sanity: exactly three prebuilds changed, no embedded images left on published rows.
do $$ begin
  if (select count(*) from public.prebuilds where slug in ('starter','haptic','motion') and image like '/rigs/es-prebuild-%') <> 3 then
    raise exception 'expected 3 prebuild rows updated';
  end if;
  if exists (select 1 from public.prebuilds where status = 'published' and image like 'data:%') then
    raise exception 'a published prebuild still has an embedded image';
  end if;
end $$;

commit;
