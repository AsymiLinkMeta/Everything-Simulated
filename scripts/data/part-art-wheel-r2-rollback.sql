begin;
update public.site_media set url = 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-part-wheel-r1.jpg', updated_at = now() where key in ('category:wheel', 'category:wheelbase');
commit;
