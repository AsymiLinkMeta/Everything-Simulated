/*
# Prebuilt Simulators System

1. New Tables

  - `prebuilds`
    - `id` (uuid, primary key)
    - `slug` (text, unique) — URL-friendly identifier
    - `name` (text) — display name e.g. "Starter Rig"
    - `kicker` (text) — short label badge e.g. "Entry Level"
    - `blurb` (text) — short description for cards
    - `description` (text) — full rich description for detail page
    - `image` (text) — hero/card image URL
    - `price_ex_gst` (integer) — admin-set price in cents, independent of component sum
    - `highlights` (jsonb) — array of highlight strings
    - `specs` (jsonb) — key-value spec pairs
    - `capabilities` (jsonb) — array of capability strings
    - `featured` (boolean) — whether to show on homepage / prebuilds listing
    - `sort_order` (integer) — display ordering (lower = first)
    - `status` (text) — draft / published / archived
    - `created_by` (uuid) — staff user who created it
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  - `prebuild_components`
    - `id` (uuid, primary key)
    - `prebuild_id` (uuid, FK → prebuilds.id ON DELETE CASCADE)
    - `sku` (text) — references a catalog product SKU
    - `qty` (integer, default 1)
    - `sort_order` (integer) — display order within the prebuild
    - `created_at` (timestamptz)

2. Security
  - RLS enabled on both tables.
  - Public (anon + authenticated) SELECT on published prebuilds and their components.
  - Staff (authenticated) full CRUD — guarded in application layer via requireStaff().
*/

-- prebuilds table
CREATE TABLE IF NOT EXISTS prebuilds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  kicker text NOT NULL DEFAULT '',
  blurb text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  image text NOT NULL DEFAULT '',
  price_ex_gst integer NOT NULL DEFAULT 0,
  highlights jsonb NOT NULL DEFAULT '[]'::jsonb,
  specs jsonb NOT NULL DEFAULT '{}'::jsonb,
  capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  featured boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE prebuilds ENABLE ROW LEVEL SECURITY;

-- Public can read published prebuilds
DROP POLICY IF EXISTS "anon_select_prebuilds" ON prebuilds;
CREATE POLICY "anon_select_prebuilds" ON prebuilds FOR SELECT
  TO anon, authenticated USING (status = 'published');

-- Staff can do anything (app-layer guard)
DROP POLICY IF EXISTS "staff_select_prebuilds" ON prebuilds;
CREATE POLICY "staff_select_prebuilds" ON prebuilds FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "staff_insert_prebuilds" ON prebuilds;
CREATE POLICY "staff_insert_prebuilds" ON prebuilds FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "staff_update_prebuilds" ON prebuilds;
CREATE POLICY "staff_update_prebuilds" ON prebuilds FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "staff_delete_prebuilds" ON prebuilds;
CREATE POLICY "staff_delete_prebuilds" ON prebuilds FOR DELETE
  TO authenticated USING (true);

-- prebuild_components table
CREATE TABLE IF NOT EXISTS prebuild_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prebuild_id uuid NOT NULL REFERENCES prebuilds(id) ON DELETE CASCADE,
  sku text NOT NULL,
  qty integer NOT NULL DEFAULT 1,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE prebuild_components ENABLE ROW LEVEL SECURITY;

-- Public can read components of published prebuilds
DROP POLICY IF EXISTS "anon_select_prebuild_components" ON prebuild_components;
CREATE POLICY "anon_select_prebuild_components" ON prebuild_components FOR SELECT
  TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM prebuilds WHERE prebuilds.id = prebuild_components.prebuild_id AND prebuilds.status = 'published')
  );

-- Staff full access
DROP POLICY IF EXISTS "staff_select_prebuild_components" ON prebuild_components;
CREATE POLICY "staff_select_prebuild_components" ON prebuild_components FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "staff_insert_prebuild_components" ON prebuild_components;
CREATE POLICY "staff_insert_prebuild_components" ON prebuild_components FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "staff_update_prebuild_components" ON prebuild_components;
CREATE POLICY "staff_update_prebuild_components" ON prebuild_components FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "staff_delete_prebuild_components" ON prebuild_components;
CREATE POLICY "staff_delete_prebuild_components" ON prebuild_components FOR DELETE
  TO authenticated USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_prebuilds_featured ON prebuilds (featured, sort_order) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_prebuild_components_prebuild ON prebuild_components (prebuild_id, sort_order);
