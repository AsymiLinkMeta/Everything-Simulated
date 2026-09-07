/*
# Add technical spec columns to catalog_products

1. Changes
- Add `max_nm` (integer): max torque rating for wheelbases/chassis.
- Add `payload_kg` (integer): payload capacity for chassis/motion systems.
- Add `weight_kg` (integer): product weight in kg for payload calculations.
- Add `mounts` (text[]): compatible mount type identifiers.
- Add `qr` (text): quick-release connector type for wheels/wheelbases.
- Add `image` (text): product image path.

2. Security
- No policy changes. Existing public SELECT and staff write policies cover these columns.

3. Important Notes
- These columns are nullable since not all products have every spec (e.g. a pedal has weight but no maxNm).
- The compatibility checker and cart use these fields to enforce build rules.
*/

ALTER TABLE public.catalog_products
  ADD COLUMN IF NOT EXISTS max_nm integer,
  ADD COLUMN IF NOT EXISTS payload_kg integer,
  ADD COLUMN IF NOT EXISTS weight_kg integer,
  ADD COLUMN IF NOT EXISTS mounts text[],
  ADD COLUMN IF NOT EXISTS qr text,
  ADD COLUMN IF NOT EXISTS image text;