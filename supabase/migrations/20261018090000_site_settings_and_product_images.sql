/*
  UI quick wins: trust bar settings and per-product photos in Storage.

  1. public.site_settings: key/value facts shown in the site's trust bar
     (lead time, warranty, try-before-you-buy, Google rating and reviews link).
     Public read; only admins write. No rows are inserted here: the bar hides
     anything that isn't set, so nothing is claimed until an admin enters it.
  2. Storage bucket "product-images" (public read, 5 MB, JPEG/PNG/WebP) with
     staff-only write policies. The catalogue keeps the public URLs in the
     existing catalog_products.images array. Skipped where the storage schema
     has no tables (plain Postgres in CI).

  Adds a table, a bucket and policies only; no existing rows change.
*/

CREATE TABLE IF NOT EXISTS public.site_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT auth.uid(),
  CONSTRAINT site_settings_key_known CHECK (key IN (
    'trust_lead_time', 'trust_warranty', 'trust_try_before',
    'trust_google_rating', 'trust_google_review_count', 'trust_google_reviews_url'
  )),
  CONSTRAINT site_settings_value_len CHECK (char_length(btrim(value)) BETWEEN 1 AND 160),
  CONSTRAINT site_settings_rating CHECK (key <> 'trust_google_rating' OR value ~ '^(?:[0-4](?:\.[0-9])?|5(?:\.0)?)$'),
  CONSTRAINT site_settings_count CHECK (key <> 'trust_google_review_count' OR value ~ '^[0-9]{1,7}$'),
  CONSTRAINT site_settings_url CHECK (key <> 'trust_google_reviews_url' OR value ~ '^https://[^\s]+$')
);

COMMENT ON TABLE public.site_settings IS 'Public site facts for the trust bar. Unset keys are hidden; never seed placeholder values.';

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_settings readable" ON public.site_settings;
CREATE POLICY "site_settings readable" ON public.site_settings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "site_settings admin insert" ON public.site_settings;
CREATE POLICY "site_settings admin insert" ON public.site_settings FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "site_settings admin update" ON public.site_settings;
CREATE POLICY "site_settings admin update" ON public.site_settings FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "site_settings admin delete" ON public.site_settings;
CREATE POLICY "site_settings admin delete" ON public.site_settings FOR DELETE TO authenticated USING (public.is_admin());

REVOKE ALL ON public.site_settings FROM anon, authenticated;
GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.site_settings TO authenticated;

CREATE OR REPLACE FUNCTION public.site_settings_touch() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.value := btrim(NEW.value);
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS site_settings_touch ON public.site_settings;
CREATE TRIGGER site_settings_touch BEFORE INSERT OR UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION public.site_settings_touch();

DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NULL OR to_regclass('storage.objects') IS NULL THEN
    RAISE NOTICE 'storage schema not installed; skipping product-images bucket';
    RETURN;
  END IF;

  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES ('product-images', 'product-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
  ON CONFLICT (id) DO NOTHING;

  EXECUTE 'DROP POLICY IF EXISTS "product images staff insert" ON storage.objects';
  EXECUTE 'CREATE POLICY "product images staff insert" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = ''product-images'' AND public.is_staff())';
  EXECUTE 'DROP POLICY IF EXISTS "product images staff update" ON storage.objects';
  EXECUTE 'CREATE POLICY "product images staff update" ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = ''product-images'' AND public.is_staff())
    WITH CHECK (bucket_id = ''product-images'' AND public.is_staff())';
  EXECUTE 'DROP POLICY IF EXISTS "product images staff delete" ON storage.objects';
  EXECUTE 'CREATE POLICY "product images staff delete" ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = ''product-images'' AND public.is_staff())';
  -- Staff need SELECT to overwrite (upsert) their own uploads; the public URL needs no policy.
  EXECUTE 'DROP POLICY IF EXISTS "product images staff select" ON storage.objects';
  EXECUTE 'CREATE POLICY "product images staff select" ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = ''product-images'' AND public.is_staff())';
END $$;
