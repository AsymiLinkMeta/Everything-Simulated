-- Restores the motion prebuild gallery to its single photo (state backed up 2026-11-05).
begin;
update public.prebuilds set gallery = jsonb_build_array('https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-prebuild-motion-1.jpg') where slug = 'motion';
commit;
