-- Shifter / handbrake category art: the re-rendered side mount bolted to the cockpit (the old render
-- floated above the floor), uploaded additively as es-part-shifter-v2.jpg (+ WebP twins).
-- Also corrects the fallback rows' size to es-hero-wide.jpg's real 2400x1350.
-- Backup: /workspace/es-redesign/backups/site_media_20261110.json. Rollback: shifter-mounted-media-rollback.sql
begin;
update public.site_media set url = 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-part-shifter-v2.jpg', width = 1000, height = 1000, updated_at = now()
  where key in ('category:shifter', 'category:handbrake');
update public.site_media set width = 2400, height = 1350, updated_at = now()
  where key in ('fallback:prebuild', 'fallback:product');
do $$ begin
  if (select count(*) from public.site_media where key in ('category:shifter', 'category:handbrake') and url like '%es-part-shifter-v2.jpg') <> 2 then
    raise exception 'shifter art not updated';
  end if;
end $$;
commit;
