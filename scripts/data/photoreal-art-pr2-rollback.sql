-- Rollback for photoreal-art-pr2.sql. Restores site_media and the starter/haptic
-- prebuilds from the backup tables created by the forward script. Leaves the new
-- storage objects in place (additive uploads are never deleted).
--
-- If the forward script has not been applied, this is a no-op on site_media/prebuilds
-- (backup tables will be missing and the script will raise).
--
-- NOT YET APPLIED: the forward script has not been run on prod.

begin;

do $$
begin
  if to_regclass('public._backup_20261112_photoreal_pr2_media') is null
     or to_regclass('public._backup_20261112_photoreal_pr2_prebuilds') is null then
    raise exception 'photoreal-art-pr2 rollback: backup tables missing; forward script was not applied';
  end if;
end $$;

update public.site_media s set
  url = b.url, width = b.width, height = b.height, alt = b.alt, sort = b.sort, updated_at = now()
from public._backup_20261112_photoreal_pr2_media b
where s.key = b.key;

update public.prebuilds p set
  image = b.image, gallery = b.gallery, updated_at = now()
from public._backup_20261112_photoreal_pr2_prebuilds b
where p.slug = b.slug;

-- sanity: none of the four keys should still be on a -pr2 url if the backup was pre-pr2
do $$
declare
  n int;
begin
  select count(*) into n from public.site_media
    where key in ('category:seat','category:shifter','category:handbrake','category:pc')
      and url like '%-pr2.jpg';
  if n > 0 then
    raise exception 'photoreal-art-pr2 rollback: % keys still on -pr2; backup may have been taken after apply', n;
  end if;
end $$;

commit;
