-- Rollback for scripts/data/redesign-media.sql. Restores prebuild image/gallery from the
-- backup table and removes the site_media rows (the UI falls back to the ES logo tile).
begin;
update public.prebuilds p set image = b.image, gallery = b.gallery
  from public._backup_20261104_prebuild_media b where b.id = p.id;
delete from public.site_media where key in (
  'fallback:product','fallback:prebuild','category:chassis','category:seat','category:wheelbase','category:wheel',
  'category:pedals','category:monitor','category:mount','category:motion','category:shifter','category:handbrake','category:pc');
commit;
-- Full schema rollback (only if the migration must go too):
--   drop table if exists public.site_media;
--   alter table public.prebuilds drop constraint if exists prebuilds_gallery_array;
--   alter table public.prebuilds drop column if exists gallery;
