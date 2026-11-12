-- Rollback for photoreal-art-pr1.sql. Restores site_media and the motion prebuild
-- from the backup tables created by the forward script. Leaves the new storage
-- objects in place (additive uploads are never deleted).
--
-- If the forward script has not been applied, this is a no-op on site_media/prebuilds
-- (backup tables will be missing and the script will raise).

-- Forward script was applied to prod 2026-11-12 16:43 America/New_York (version 20261112164349).

begin;

update public.site_media s set
  url = b.url, width = b.width, height = b.height, alt = b.alt, sort = b.sort, updated_at = now()
from public._backup_20261112_photoreal_media b
where s.key = b.key;

update public.prebuilds p set
  image = b.image, gallery = b.gallery
from public._backup_20261112_photoreal_prebuilds b
where p.slug = b.slug;

do $$ begin
  if exists (select 1 from public.site_media where url like '%-pr1.jpg' and key in (
    'fallback:product', 'fallback:prebuild', 'category:chassis', 'category:seat',
    'category:wheel', 'category:wheelbase', 'category:pedals', 'category:monitor',
    'category:mount', 'category:motion', 'category:shifter', 'category:handbrake'
  )) then
    raise exception 'rollback failed: some site_media rows still point at -pr1';
  end if;
  if (select image from public.prebuilds where slug = 'motion') like '%-pr1.jpg' then
    raise exception 'rollback failed: motion prebuild still on -pr1';
  end if;
end $$;

commit;
