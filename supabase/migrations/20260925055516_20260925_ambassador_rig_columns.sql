/*
# Add rig_note and rig_specs to ambassadors

1. New Columns
- `ambassadors.rig_note` (text, nullable) — optional note shown on the ambassador profile describing their personal rig setup
- `ambassadors.rig_specs` (jsonb, nullable, default '[]') — array of { label, value } spec rows shown on the ambassador card and profile

2. Data Update
- Back-fills Carter Cosgrove Racing with the rig_note and rig_specs previously hardcoded in the app,
  and sets `crate` to 'haptic' and `photo` to '/rigs/haptic.jpg' to match the hardcoded version.

3. Security
- No policy changes. The existing `public_select_published_ambassadors` SELECT policy already
  exposes all columns to anon + authenticated readers, so the new columns are publicly readable
  for published ambassadors. Staff INSERT/UPDATE/DELETE policies already cover all columns.
*/

ALTER TABLE ambassadors
  ADD COLUMN IF NOT EXISTS rig_note text,
  ADD COLUMN IF NOT EXISTS rig_specs jsonb DEFAULT '[]'::jsonb;

UPDATE ambassadors
SET
  photo = '/rigs/haptic.jpg',
  crate = 'haptic',
  rig_note = 'Haptic crate in the same family the workshop builds for driver programs. Exact personal spec lands when they send the list — until then this is the published Haptic prebuild.',
  rig_specs = '[
    {"label": "Chassis", "value": "Exodus XR1"},
    {"label": "Wheelbase", "value": "Simagic Alpha 15Nm"},
    {"label": "Pedals", "value": "P1000 hydraulic + haptics"},
    {"label": "Screens", "value": "Triple 32\" + 27\" aux"},
    {"label": "Software", "value": "iRacing 12 months"}
  ]'::jsonb,
  updated_at = now()
WHERE slug = 'carter-cosgrove-racing';
