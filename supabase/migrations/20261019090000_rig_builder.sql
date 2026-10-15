/*
  # Rig builder (/build): DB-driven badges and preview layers

  1. catalog_products.builder_badge (nullable): 'most_popular' | 'flagship' | 'best_value' | 'new'.
     Shown on the builder's component cards. New column, every row starts NULL:
     no existing data changes. Readable by anon/authenticated (column grant, see
     20261017100000_hide_catalog_cost); written by staff through the existing policies.

  2. builder_layers: transparent PNG/WebP layers for the 2D rig preview.
     One row per category (sku NULL = default art for that category) or per product
     (sku set = that product's own layer). z orders the stack. Public read, staff write.
     Starts empty: the builder falls back to a drawn silhouette until staff add art.
*/
ALTER TABLE public.catalog_products ADD COLUMN IF NOT EXISTS builder_badge text;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'catalog_products_builder_badge_check') THEN
    ALTER TABLE public.catalog_products
      ADD CONSTRAINT catalog_products_builder_badge_check
      CHECK (builder_badge IS NULL OR builder_badge IN ('most_popular', 'flagship', 'best_value', 'new'));
  END IF;
END $$;
GRANT SELECT (builder_badge) ON public.catalog_products TO anon, authenticated;

CREATE TABLE IF NOT EXISTS public.builder_layers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category ~ '^[a-z_]{2,32}$'),
  sku text REFERENCES public.catalog_products (sku) ON UPDATE CASCADE ON DELETE CASCADE,
  image_url text NOT NULL CHECK (image_url ~ '^(https://|/)[^\s]+$' AND length(image_url) <= 500),
  z integer NOT NULL DEFAULT 0 CHECK (z BETWEEN -100 AND 100),
  label text CHECK (label IS NULL OR length(label) <= 80),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS builder_layers_category_default ON public.builder_layers (category) WHERE sku IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS builder_layers_sku ON public.builder_layers (sku) WHERE sku IS NOT NULL;

ALTER TABLE public.builder_layers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.builder_layers FROM anon, authenticated;
GRANT SELECT ON public.builder_layers TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.builder_layers TO authenticated;

DROP POLICY IF EXISTS builder_layers_read ON public.builder_layers;
CREATE POLICY builder_layers_read ON public.builder_layers FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS builder_layers_staff_insert ON public.builder_layers;
CREATE POLICY builder_layers_staff_insert ON public.builder_layers FOR INSERT TO authenticated WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS builder_layers_staff_update ON public.builder_layers;
CREATE POLICY builder_layers_staff_update ON public.builder_layers FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS builder_layers_staff_delete ON public.builder_layers;
CREATE POLICY builder_layers_staff_delete ON public.builder_layers FOR DELETE TO authenticated USING (public.is_staff());

CREATE OR REPLACE FUNCTION public.builder_layers_touch() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS builder_layers_touch ON public.builder_layers;
CREATE TRIGGER builder_layers_touch BEFORE UPDATE ON public.builder_layers FOR EACH ROW EXECUTE FUNCTION public.builder_layers_touch();
