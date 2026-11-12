-- Rollback for part-art-real.sql (values as they were on 2026-11-10).
begin;
update public.site_media set url = 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-part-chassis.jpg', width = 1000, height = 1000, updated_at = now() where key = 'category:chassis';
update public.site_media set url = 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-part-shifter-v2.jpg', width = 1000, height = 1000, updated_at = now() where key = 'category:handbrake';
update public.site_media set url = 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-part-screens.jpg', width = 1000, height = 1000, updated_at = now() where key = 'category:monitor';
update public.site_media set url = 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-part-motion.jpg', width = 1000, height = 1000, updated_at = now() where key = 'category:motion';
update public.site_media set url = 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-part-screens.jpg', width = 1000, height = 1000, updated_at = now() where key = 'category:mount';
update public.site_media set url = 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-part-pc.jpg', width = 1000, height = 1000, updated_at = now() where key = 'category:pc';
update public.site_media set url = 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-part-pedals.jpg', width = 1000, height = 1000, updated_at = now() where key = 'category:pedals';
update public.site_media set url = 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-part-seat.jpg', width = 1000, height = 1000, updated_at = now() where key = 'category:seat';
update public.site_media set url = 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-part-shifter-v2.jpg', width = 1000, height = 1000, updated_at = now() where key = 'category:shifter';
update public.site_media set url = 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-part-wheel.jpg', width = 1000, height = 1000, updated_at = now() where key = 'category:wheel';
update public.site_media set url = 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-part-wheel.jpg', width = 1000, height = 1000, updated_at = now() where key = 'category:wheelbase';
commit;
