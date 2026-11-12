-- Wheel / wheelbase art: r2 framing (wheelbase, quick release and deck from the side; r1 cropped the
-- deck brackets awkwardly in small tiles). Rollback: part-art-wheel-r2-rollback.sql (back to r1);
-- part-art-real-rollback.sql restores the pre-2026-11-10 art for every category.
begin;
update public.site_media set url = 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-part-wheel-r2.jpg', updated_at = now() where key in ('category:wheel', 'category:wheelbase');
commit;
