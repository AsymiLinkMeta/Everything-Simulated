-- Motion prebuild: gallery 1 -> 4 ES studio renders (es-prebuild-motion-2..4 uploaded to product-images/site/, with .webp twins).
-- Applied to prod 2026-11-05 with Patrick's OK (t40u). Rollback: motion-prebuild-gallery-rollback.sql
begin;
update public.prebuilds set gallery = jsonb_build_array(
  'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-prebuild-motion-1.jpg', 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-prebuild-motion-2.jpg',
  'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-prebuild-motion-3.jpg', 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-prebuild-motion-4.jpg')
where slug = 'motion';
do $$ begin
  if (select jsonb_array_length(gallery) from public.prebuilds where slug = 'motion') <> 4 then
    raise exception 'motion gallery not updated';
  end if;
end $$;
commit;
