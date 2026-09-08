/*
# Brands table

1. New Tables
- `brands` — stores brand logos and links for the homepage banner and portal management.
  - `id` (uuid, primary key)
  - `name` (text, not null) — brand display name
  - `slug` (text, unique, not null) — URL-safe identifier
  - `icon_url` (text) — logo image URL (transparent PNG preferred)
  - `link_url` (text) — external link to brand website
  - `sort_order` (integer, default 0) — display ordering
  - `created_at` (timestamptz, default now())

2. Security
- Enable RLS on `brands`.
- Public read: anyone (anon + authenticated) can view brands for the homepage banner.
- Staff-only insert/update/delete: enforced via `public.is_staff()` and `public.is_admin()`.
*/

CREATE TABLE IF NOT EXISTS public.brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  icon_url text,
  link_url text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS brands_sort_idx ON public.brands (sort_order, name);

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select_brands" ON public.brands;
CREATE POLICY "public_select_brands" ON public.brands FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "staff_insert_brands" ON public.brands;
CREATE POLICY "staff_insert_brands" ON public.brands FOR INSERT
  TO authenticated WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "staff_update_brands" ON public.brands;
CREATE POLICY "staff_update_brands" ON public.brands FOR UPDATE
  TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "admin_delete_brands" ON public.brands;
CREATE POLICY "admin_delete_brands" ON public.brands FOR DELETE
  TO authenticated USING (public.is_admin());
