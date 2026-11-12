-- Square product art (run ONLY after approval; after redesign-media.sql).
-- Product tiles and the product page gallery are square, so the 16:9 es-cat-* renders get
-- cropped there (the wheel base was cut off at the edge). This points the per-category
-- fallback art at the square es-part-* studio close-ups instead. Page heroes keep es-cat-*.
-- Needs public/rigs/es-part-*.jpg uploaded to Storage product-images/site/ first.
--
-- Run:      psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/data/part-art-media.sql
-- Rollback: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/data/part-art-media-rollback.sql
begin;
update public.site_media m set url = v.url, width = 1000, height = 1000
from (values
  ('category:chassis',   'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-part-chassis.jpg'),
  ('category:seat',      'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-part-seat.jpg'),
  ('category:wheelbase', 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-part-wheel.jpg'),
  ('category:wheel',     'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-part-wheel.jpg'),
  ('category:pedals',    'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-part-pedals.jpg'),
  ('category:monitor',   'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-part-screens.jpg'),
  ('category:mount',     'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-part-screens.jpg'),
  ('category:motion',    'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-part-motion.jpg'),
  ('category:shifter',   'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-part-shifter.jpg'),
  ('category:handbrake', 'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-part-shifter.jpg'),
  ('category:pc',        'https://wejllrdvkufsdxcfwwvl.supabase.co/storage/v1/object/public/product-images/site/es-part-pc.jpg')
) as v(key, url)
where m.key = v.key;
commit;
