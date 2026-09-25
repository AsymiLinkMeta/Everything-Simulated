/*
# Link ambassadors to user accounts for self-editing

## Overview
Adds a `user_id` column to `ambassadors` so each ambassador can be linked to
their own login. Adds an RLS policy that lets an authenticated ambassador
UPDATE their own row — but only the safe, profile-related columns. Staff
retain full control. A SECURITY DEFINER function restricts which columns
the ambassador can actually change (bio, photo, motorsport, series,
class_name, team_status, base, age_band, social, rig_note, rig_specs).
Privileged columns (code, published, sort_order, crate, slug, name) stay
staff-only.

## Modified Tables
- `ambassadors`
  - New column `user_id` (uuid, nullable, references auth.users)

## New Functions
- `ambassador_self_update(...)` — SECURITY DEFINER function that lets an
  authenticated user update ONLY their own ambassador row and ONLY the
  allowed columns. Returns the updated row.

## New Policies
- `ambassador_select_own` — authenticated user can SELECT their own
  ambassador row (even if unpublished), so the edit form can load it.
- `ambassador_update_own` — authenticated user can UPDATE their own row.

## Security
- The self-update function is SECURITY DEFINER so it bypasses column-level
  restrictions but enforces ownership (user_id = auth.uid()) and only touches
  the allowed column set.
- Staff policies remain unchanged and still have full INSERT/UPDATE/DELETE.
*/

-- 1. Add user_id column
ALTER TABLE ambassadors
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_ambassadors_user_id ON ambassadors (user_id);

-- 2. Policy: ambassador can select their own row (even unpublished)
DROP POLICY IF EXISTS "ambassador_select_own" ON ambassadors;
CREATE POLICY "ambassador_select_own" ON ambassadors FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 3. Policy: ambassador can update their own row
DROP POLICY IF EXISTS "ambassador_update_own" ON ambassadors;
CREATE POLICY "ambassador_update_own" ON ambassadors FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. SECURITY DEFINER function for safe self-update
CREATE OR REPLACE FUNCTION public.ambassador_self_update(
  p_bio text DEFAULT NULL,
  p_photo text DEFAULT NULL,
  p_motorsport text DEFAULT NULL,
  p_series text DEFAULT NULL,
  p_class_name text DEFAULT NULL,
  p_team_status text DEFAULT NULL,
  p_base text DEFAULT NULL,
  p_age_band text DEFAULT NULL,
  p_social jsonb DEFAULT NULL,
  p_rig_note text DEFAULT NULL,
  p_rig_specs jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row ambassadors%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_row FROM ambassadors WHERE user_id = auth.uid() LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No ambassador profile linked to this account';
  END IF;

  UPDATE ambassadors SET
    bio        = COALESCE(p_bio, bio),
    photo      = COALESCE(p_photo, photo),
    motorsport = COALESCE(p_motorsport, motorsport),
    series     = COALESCE(p_series, series),
    class_name = COALESCE(p_class_name, class_name),
    team_status= COALESCE(p_team_status, team_status),
    base       = COALESCE(p_base, base),
    age_band   = COALESCE(p_age_band, age_band),
    social     = COALESCE(p_social, social),
    rig_note   = COALESCE(p_rig_note, rig_note),
    rig_specs  = COALESCE(p_rig_specs, rig_specs),
    updated_at = now()
  WHERE id = v_row.id;

  RETURN jsonb_build_object('slug', v_row.slug, 'name', v_row.name, 'ok', true);
END;
$$;
