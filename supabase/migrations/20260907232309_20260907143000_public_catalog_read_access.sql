/*
# Make catalogue products readable by shoppers

1. Changes
- Add a public SELECT policy for `catalog_products` so the shop and build pages can load database-backed products.
- Keep INSERT, UPDATE, and DELETE restricted to staff/admin policies already on the table.

2. Security
- Only the existing non-sensitive catalogue fields are exposed through the table's selected columns.
- No write permissions are added for anonymous visitors.

3. Important Notes
- This is intentionally public catalogue data, not customer or staff-private data.
- The application will continue to enforce compatibility rules separately.
*/

DROP POLICY IF EXISTS "public_select_catalog_products" ON public.catalog_products;
CREATE POLICY "public_select_catalog_products" ON public.catalog_products FOR SELECT
  TO anon, authenticated USING (true);