/*
# Ambassadors table

## Overview
Creates a dedicated table for ambassador (sponsored driver) profiles.
Previously ambassadors were hardcoded in TypeScript; this table moves them
into the database so staff can manage cards without a code deploy.

## New Tables
- `ambassadors`
  - `id` (uuid, primary key, default gen_random_uuid())
  - `slug` (text, unique, not null) — URL-safe identifier used in links
  - `name` (text, not null) — display / race name
  - `photo` (text, nullable) — photo URL, staff-published with guardian sign-off if under 18
  - `bio` (text, not null) — short bio written by the driver
  - `motorsport` (text, nullable) — discipline (sprint, kart, Carrera Cup, etc.)
  - `series` (text, nullable) — championship they are in this season, free text
  - `class_name` (text, nullable) — class inside that series, free text
  - `team_status` (text, nullable) — privateer, works, family team, etc.
  - `base` (text, nullable) — city or region (never a street address)
  - `age_band` (text, nullable) — U12 / 12-15 / 16-17 / 18+, never a date of birth
  - `crate` (text, nullable) — associated rig / crate slug if any
  - `code` (text, unique, not null) — referral code used at checkout, uppercase
  - `social` (jsonb, nullable) — { instagram, tiktok, youtube, facebook } URLs
  - `published` (boolean, not null, default false) — only published cards show publicly
  - `sort_order` (integer, not null, default 0) — manual ordering on the ambassadors page
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

## Security
- RLS enabled on `ambassadors`.
- Public (anon + authenticated) can SELECT published ambassadors only.
- Staff can SELECT all ambassadors (including unpublished).
- Staff can INSERT, UPDATE, DELETE ambassadors.
- Uses existing `public.is_staff()` helper from migration 0003.

## Seed Data
- Inserts the single existing hardcoded ambassador (Carter Cosgrove Racing)
  so the page does not go blank after the cutover.
*/

CREATE TABLE IF NOT EXISTS ambassadors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  photo text,
  bio text NOT NULL DEFAULT '',
  motorsport text,
  series text,
  class_name text,
  team_status text,
  base text,
  age_band text CHECK (age_band IN ('U12', '12-15', '16-17', '18+')),
  crate text,
  code text UNIQUE NOT NULL,
  social jsonb DEFAULT '{}'::jsonb,
  published boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ambassadors ENABLE ROW LEVEL SECURITY;

-- Public can read published ambassadors only
DROP POLICY IF EXISTS "public_select_published_ambassadors" ON ambassadors;
CREATE POLICY "public_select_published_ambassadors" ON ambassadors FOR SELECT
  TO anon, authenticated
  USING (published = true);

-- Staff can read all ambassadors (including unpublished)
DROP POLICY IF EXISTS "staff_select_all_ambassadors" ON ambassadors;
CREATE POLICY "staff_select_all_ambassadors" ON ambassadors FOR SELECT
  TO authenticated
  USING (public.is_staff());

-- Staff can insert ambassadors
DROP POLICY IF EXISTS "staff_insert_ambassadors" ON ambassadors;
CREATE POLICY "staff_insert_ambassadors" ON ambassadors FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff());

-- Staff can update ambassadors
DROP POLICY IF EXISTS "staff_update_ambassadors" ON ambassadors;
CREATE POLICY "staff_update_ambassadors" ON ambassadors FOR UPDATE
  TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- Staff can delete ambassadors
DROP POLICY IF EXISTS "staff_delete_ambassadors" ON ambassadors;
CREATE POLICY "staff_delete_ambassadors" ON ambassadors FOR DELETE
  TO authenticated
  USING (public.is_staff());

-- Seed the existing hardcoded ambassador
INSERT INTO ambassadors (slug, name, bio, motorsport, team_status, base, code, published, sort_order)
VALUES (
  'carter-cosgrove-racing',
  'Carter Cosgrove Racing',
  'A driver program the workshop has publicly stood with. Bio, series and socials are theirs to fill — this card updates when they send them.',
  'Sprint / club racing',
  'Program',
  'Queensland',
  'COSGROVE',
  true,
  0
)
ON CONFLICT (slug) DO NOTHING;

-- Index for efficient public listing
CREATE INDEX IF NOT EXISTS idx_ambassadors_published_sort
  ON ambassadors (published, sort_order);
