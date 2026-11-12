/*
  Redesign: site imagery comes from data, not code.

  1. public.site_media: keyed images the site shows where the catalogue has no
     photo of its own: per-category renders ('category:<product category>') and
     fallbacks ('fallback:product', 'fallback:prebuild', 'fallback:ambassador').
     Public read; staff write. No rows are inserted here (the data script
     scripts/data/site-media-seed.sql does that, separately and on approval).
     A missing key falls back to the plain Everything Simulated tile in the UI.
  2. public.prebuilds.gallery: ordered extra photos for a prebuild's page,
     [{ "url": "...", "alt": "..." }]. Defaults to an empty array, so every
     existing row keeps its current look.

  Adds a table, a column with a default and policies only; no existing rows change.
*/

CREATE TABLE IF NOT EXISTS public.site_media (
  key text PRIMARY KEY,
  url text NOT NULL,
  alt text NOT NULL DEFAULT '',
  width integer,
  height integer,
  sort integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_media_key_shape CHECK (key ~ '^(category|fallback|page):[a-z0-9_-]{1,40}$'),
  CONSTRAINT site_media_url_shape CHECK (url ~ '^(/[^\s]+|https://[^\s]+)$' AND char_length(url) <= 600),
  CONSTRAINT site_media_alt_len CHECK (char_length(alt) <= 200),
  CONSTRAINT site_media_size CHECK ((width IS NULL OR width BETWEEN 1 AND 10000) AND (height IS NULL OR height BETWEEN 1 AND 10000))
);

COMMENT ON TABLE public.site_media IS 'Images the site shows where the catalogue has none: category renders and fallbacks. Missing keys fall back to a plain brand tile.';

ALTER TABLE public.site_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_media readable" ON public.site_media;
CREATE POLICY "site_media readable" ON public.site_media FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "site_media staff insert" ON public.site_media;
CREATE POLICY "site_media staff insert" ON public.site_media FOR INSERT TO authenticated WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "site_media staff update" ON public.site_media;
CREATE POLICY "site_media staff update" ON public.site_media FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "site_media staff delete" ON public.site_media;
CREATE POLICY "site_media staff delete" ON public.site_media FOR DELETE TO authenticated USING (public.is_staff());

REVOKE ALL ON public.site_media FROM anon, authenticated;
GRANT SELECT ON public.site_media TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.site_media TO authenticated;

CREATE OR REPLACE FUNCTION public.site_media_touch() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.url := btrim(NEW.url);
  NEW.alt := btrim(NEW.alt);
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS site_media_touch ON public.site_media;
CREATE TRIGGER site_media_touch BEFORE INSERT OR UPDATE ON public.site_media
  FOR EACH ROW EXECUTE FUNCTION public.site_media_touch();

ALTER TABLE public.prebuilds ADD COLUMN IF NOT EXISTS gallery jsonb NOT NULL DEFAULT '[]'::jsonb;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prebuilds_gallery_array') THEN
    ALTER TABLE public.prebuilds ADD CONSTRAINT prebuilds_gallery_array
      CHECK (jsonb_typeof(gallery) = 'array' AND jsonb_array_length(gallery) <= 12);
  END IF;
END $$;
COMMENT ON COLUMN public.prebuilds.gallery IS 'Extra photos for the prebuild page: [{"url": "...", "alt": "..."}], in order.';
