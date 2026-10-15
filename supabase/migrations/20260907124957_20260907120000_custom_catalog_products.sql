/*
# Add staff product listing generator storage

1. New Tables
- `catalog_products`
- `id` (uuid primary key): saved product listing identifier.
- `sku` (text unique): staff-created catalogue SKU.
- `brand` (text): product brand.
- `name` (text): customer-facing product name.
- `category` (text): catalogue category.
- `sell_ex_gst` (integer): selling price in Australian cents before GST.
- `stock_status` (text): stock, indent, or discontinued.
- `lead_weeks_min` and `lead_weeks_max` (integer): expected delivery range.
- `description` (text): customer-facing listing copy.
- `notes` (text): internal staff notes.
- `created_by` (text): authenticated staff member who saved the listing.
- `created_at` and `updated_at` (timestamptz): audit timestamps.

2. Security
- Row level security is enabled on `catalog_products`.
- Staff can read, create, and update catalogue products.
- Only admins can delete catalogue products.
- Ownership is taken from the authenticated session for created records.

3. Important Notes
- Existing static catalogue products and price overrides are unchanged.
- Prices are stored as integer cents to match the existing catalogue format.
- The frontend only submits editable product content; the database supplies the creator identity.
*/

CREATE TABLE IF NOT EXISTS public.catalog_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL UNIQUE,
  brand text NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  sell_ex_gst integer NOT NULL CHECK (sell_ex_gst >= 0),
  stock_status text NOT NULL DEFAULT 'indent' CHECK (stock_status IN ('stock', 'indent', 'discontinued')),
  lead_weeks_min integer NOT NULL DEFAULT 2 CHECK (lead_weeks_min >= 0),
  lead_weeks_max integer NOT NULL DEFAULT 6 CHECK (lead_weeks_max >= lead_weeks_min),
  description text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_by text NOT NULL DEFAULT auth.uid()::text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS catalog_products_category_idx ON public.catalog_products (category);
CREATE INDEX IF NOT EXISTS catalog_products_created_at_idx ON public.catalog_products (created_at DESC);

ALTER TABLE public.catalog_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_select_catalog_products" ON public.catalog_products;
CREATE POLICY "staff_select_catalog_products" ON public.catalog_products FOR SELECT
  TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "staff_insert_catalog_products" ON public.catalog_products;
CREATE POLICY "staff_insert_catalog_products" ON public.catalog_products FOR INSERT
  TO authenticated WITH CHECK (public.is_staff() AND created_by = auth.uid()::text);

DROP POLICY IF EXISTS "staff_update_catalog_products" ON public.catalog_products;
CREATE POLICY "staff_update_catalog_products" ON public.catalog_products FOR UPDATE
  TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "admin_delete_catalog_products" ON public.catalog_products;
CREATE POLICY "admin_delete_catalog_products" ON public.catalog_products FOR DELETE
  TO authenticated USING (public.is_admin());
