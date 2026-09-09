/*
# Add missing catalog columns and seed all 22 products

1. Altered Tables
  - `catalog_products` — adds columns that the server code expects but don't exist:
    - `listing_status` (text, default 'published')
    - `qty_on_hand` (integer, default 0)
    - `cost_ex_gst` (integer, default 0)
    - `image_url` (text, nullable)
    - `images` (jsonb, default '[]')
    - `manufacturer_url` (text, nullable)
  - Makes `created_by` nullable (was NOT NULL, blocks seed inserts without a user)

2. Data
  - Inserts all 22 hardcoded products into catalog_products.
  - Uses ON CONFLICT (sku) DO UPDATE to be idempotent.

3. Notes
  - All prices are 0 (quote-only) as per the original hardcoded data.
  - Staff can set real prices via the admin portal.
*/

-- Add missing columns if they don't exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='catalog_products' AND column_name='listing_status') THEN
    ALTER TABLE catalog_products ADD COLUMN listing_status text NOT NULL DEFAULT 'published';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='catalog_products' AND column_name='qty_on_hand') THEN
    ALTER TABLE catalog_products ADD COLUMN qty_on_hand integer NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='catalog_products' AND column_name='cost_ex_gst') THEN
    ALTER TABLE catalog_products ADD COLUMN cost_ex_gst integer NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='catalog_products' AND column_name='image_url') THEN
    ALTER TABLE catalog_products ADD COLUMN image_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='catalog_products' AND column_name='images') THEN
    ALTER TABLE catalog_products ADD COLUMN images jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='catalog_products' AND column_name='manufacturer_url') THEN
    ALTER TABLE catalog_products ADD COLUMN manufacturer_url text;
  END IF;
END $$;

-- Allow created_by to be null for seed data
ALTER TABLE catalog_products ALTER COLUMN created_by DROP NOT NULL;

-- Seed all 22 products
INSERT INTO catalog_products (sku, brand, name, category, sell_ex_gst, stock_status, listing_status, lead_weeks_min, lead_weeks_max, max_nm, payload_kg, weight_kg, mounts, qr, image, notes, description)
VALUES
  ('tr120s', 'Trak Racer', 'TR120S V2 Chassis', 'chassis', 0, 'indent', 'published', 3, 6, 15, 180, NULL, ARRAY['tr_front_plate'], NULL, '/rigs/starter.jpg', 'Starter Rig include. Individual sale by quote.', ''),
  ('xr1', 'Exodus', 'XR1 Heavy-Duty Racing Frame', 'chassis', 0, 'indent', 'published', 3, 6, 28, 260, NULL, ARRAY['exodus_deck','simagic_side'], NULL, '/rigs/haptic.jpg', 'Haptic and Motion include. Individual sale by quote.', ''),
  ('alpha-evo-12', 'Simagic', 'Alpha EVO 12nm Direct Drive Wheelbase', 'wheelbase', 0, 'indent', 'published', 3, 6, 12, NULL, NULL, ARRAY['simagic_side','tr_front_plate'], 'simagic_qr', NULL, 'Starter Rig include.', ''),
  ('alpha-15', 'Simagic', 'Alpha 15nm Wheelbase', 'wheelbase', 0, 'indent', 'published', 3, 6, 15, NULL, NULL, ARRAY['simagic_side','exodus_deck'], 'simagic_qr', NULL, 'Haptic and Motion include.', ''),
  ('gt-neo', 'Simagic', 'GT NEO Wheel', 'wheel', 0, 'indent', 'published', 3, 6, NULL, NULL, NULL, NULL, 'simagic_qr', NULL, 'Included on Starter, Haptic and Motion.', ''),
  ('p1000', 'Simagic', 'P1000 Pedals', 'pedals', 0, 'indent', 'published', 3, 6, NULL, NULL, 8, NULL, NULL, NULL, 'Starter Rig include.', ''),
  ('p1000-haptic', 'Simagic', 'P1000 Pedals with Hydraulic Brake and Haptics', 'pedals', 0, 'indent', 'published', 3, 6, NULL, NULL, 12, NULL, NULL, NULL, 'Haptic and Motion include.', ''),
  ('seq-shifter', 'Simagic', 'Sequential Shifter', 'shifter', 0, 'indent', 'published', 3, 6, NULL, NULL, NULL, NULL, NULL, NULL, 'Included on Starter, Haptic and Motion.', ''),
  ('handbrake', 'Simagic', 'Handbrake', 'handbrake', 0, 'indent', 'published', 3, 6, NULL, NULL, NULL, NULL, NULL, NULL, 'Starter Rig include.', ''),
  ('touring-seat', 'Everything Simulated', 'Large Touring Race Seat', 'seat', 0, 'indent', 'published', 3, 6, NULL, NULL, 14, NULL, NULL, '/rigs/haptic.jpg', 'Haptic and Motion include.', ''),
  ('sr2', 'SIMRIG', 'SR2 Motion System', 'motion', 0, 'indent', 'published', 4, 6, NULL, 225, 48, NULL, NULL, '/rigs/motion.jpg', 'Motion package include. XR1 only.', ''),
  ('aoc-32', 'AOC', '32-inch Curved 240Hz Monitor', 'monitor', 0, 'indent', 'published', 3, 6, NULL, NULL, 7, NULL, NULL, '/rigs/haptic.jpg', 'Triple 32-inch on packaged builds.', ''),
  ('aux-27', 'Everything Simulated', '27-inch 100Hz Auxiliary Monitor', 'monitor', 0, 'indent', 'published', 3, 6, NULL, NULL, 4, NULL, NULL, NULL, 'Haptic and Motion include.', ''),
  ('quad-mount', 'Everything Simulated', 'Free-standing 4-screen Monitor Frame', 'mount', 0, 'indent', 'published', 3, 6, NULL, NULL, NULL, NULL, NULL, '/rigs/haptic.jpg', 'Exodus XR1 only. Blocked on TR120S.', ''),
  ('pc-starter', 'Everything Simulated', 'Brand-new Gaming PC optimised for racing titles', 'pc', 0, 'indent', 'published', 3, 6, NULL, NULL, NULL, NULL, NULL, '/rigs/starter.jpg', 'Starter Rig include.', ''),
  ('pc-race', 'Everything Simulated', 'High-performance Racing PC (i9 / RTX 5070 Ti)', 'pc', 0, 'indent', 'published', 3, 6, NULL, NULL, NULL, NULL, NULL, '/rigs/haptic.jpg', 'Haptic and Motion include.', ''),
  ('logi-surround', 'Logitech', '1000W Surround Sound System', 'audio', 0, 'indent', 'published', 3, 6, NULL, NULL, NULL, NULL, NULL, NULL, 'Included on packaged builds.', ''),
  ('pro-x', 'Logitech', 'Pro X Headset', 'headset', 0, 'indent', 'published', 3, 6, NULL, NULL, NULL, NULL, NULL, NULL, 'Haptic and Motion include.', ''),
  ('iracing-12', 'iRacing', '12-month iRacing Subscription', 'software', 0, 'stock', 'published', 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, 'Haptic and Motion include.', ''),
  ('iracing-skin', 'iRacing', 'Custom Sprintcar Skin', 'software', 0, 'indent', 'published', 1, 2, NULL, NULL, NULL, NULL, NULL, NULL, 'Haptic and Motion include.', ''),
  ('livery', 'Everything Simulated', 'Custom Simulator Livery', 'accessory', 0, 'indent', 'published', 2, 4, NULL, NULL, NULL, NULL, NULL, NULL, 'Haptic and Motion include.', ''),
  ('side-mount', 'Simagic', 'Side Mount Kit for Trak Racer', 'adapter', 0, 'stock', 'published', 1, 2, NULL, NULL, NULL, NULL, NULL, NULL, 'Required when mounting Alpha EVO on TR120S.', '')
ON CONFLICT (sku) DO UPDATE SET
  brand = EXCLUDED.brand,
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  stock_status = EXCLUDED.stock_status,
  listing_status = EXCLUDED.listing_status,
  lead_weeks_min = EXCLUDED.lead_weeks_min,
  lead_weeks_max = EXCLUDED.lead_weeks_max,
  max_nm = COALESCE(EXCLUDED.max_nm, catalog_products.max_nm),
  payload_kg = COALESCE(EXCLUDED.payload_kg, catalog_products.payload_kg),
  weight_kg = COALESCE(EXCLUDED.weight_kg, catalog_products.weight_kg),
  mounts = COALESCE(EXCLUDED.mounts, catalog_products.mounts),
  qr = COALESCE(EXCLUDED.qr, catalog_products.qr),
  image = COALESCE(EXCLUDED.image, catalog_products.image),
  notes = EXCLUDED.notes,
  updated_at = now();
