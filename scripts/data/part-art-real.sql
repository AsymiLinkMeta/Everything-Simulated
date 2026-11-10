-- Category product art -> realistic ES part renders (--real materials), with the seat, wheel, pedals and
-- shifter shown mounted on the cockpit (they floated before). Uploaded additively as es-part-<part>-r1.jpg
-- with WebP twins. Backup: /workspace/es-redesign/backups/site_media_categories_20261110.json.
-- Rollback: part-art-real-rollback.sql
begin;
update public.site_media set url = 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-part-chassis-r1.jpg', width = 1000, height = 1000, updated_at = now() where key = 'category:chassis';
update public.site_media set url = 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-part-shifter-r1.jpg', width = 1000, height = 1000, updated_at = now() where key = 'category:handbrake';
update public.site_media set url = 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-part-screens-r1.jpg', width = 1000, height = 1000, updated_at = now() where key = 'category:monitor';
update public.site_media set url = 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-part-motion-r1.jpg', width = 1000, height = 1000, updated_at = now() where key = 'category:motion';
update public.site_media set url = 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-part-screens-r1.jpg', width = 1000, height = 1000, updated_at = now() where key = 'category:mount';
update public.site_media set url = 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-part-pc-r1.jpg', width = 1000, height = 1000, updated_at = now() where key = 'category:pc';
update public.site_media set url = 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-part-pedals-r1.jpg', width = 1000, height = 1000, updated_at = now() where key = 'category:pedals';
update public.site_media set url = 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-part-seat-r1.jpg', width = 1000, height = 1000, updated_at = now() where key = 'category:seat';
update public.site_media set url = 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-part-shifter-r1.jpg', width = 1000, height = 1000, updated_at = now() where key = 'category:shifter';
update public.site_media set url = 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-part-wheel-r1.jpg', width = 1000, height = 1000, updated_at = now() where key = 'category:wheel';
update public.site_media set url = 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-part-wheel-r1.jpg', width = 1000, height = 1000, updated_at = now() where key = 'category:wheelbase';
do $$ begin
  if (select count(*) from public.site_media where key like 'category:%' and url like '%-r1.jpg') <> 11 then
    raise exception 'category art not updated';
  end if;
end $$;
commit;
