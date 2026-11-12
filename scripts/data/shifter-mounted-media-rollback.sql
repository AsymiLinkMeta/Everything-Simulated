-- Rollback for shifter-mounted-media.sql (values as they were on 2026-11-10).
begin;
update public.site_media set url = 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-part-shifter.jpg', width = 1000, height = 1000, updated_at = now()
  where key in ('category:shifter', 'category:handbrake');
update public.site_media set width = 1600, height = 1200, updated_at = now()
  where key in ('fallback:prebuild', 'fallback:product');
commit;
