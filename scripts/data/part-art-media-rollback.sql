-- Rollback for part-art-media.sql: category art back to the 16:9 es-cat-* renders.
begin;
update public.site_media m set url = v.url, width = 1600, height = 1200
from (values
  ('category:chassis', 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-cat-chassis.jpg'),
  ('category:seat', 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-cat-seat.jpg'),
  ('category:wheelbase', 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-cat-wheel.jpg'),
  ('category:wheel', 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-cat-wheel.jpg'),
  ('category:pedals', 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-cat-pedals.jpg'),
  ('category:monitor', 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-cat-screens.jpg'),
  ('category:mount', 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-cat-screens.jpg'),
  ('category:motion', 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-cat-motion.jpg'),
  ('category:shifter', 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-cat-shifter.jpg'),
  ('category:handbrake', 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-cat-shifter.jpg'),
  ('category:pc', 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-cat-pc.jpg')
) as v(key, url)
where m.key = v.key;
commit;
