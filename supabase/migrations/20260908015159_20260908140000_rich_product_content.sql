ALTER TABLE catalog_products
  ADD COLUMN IF NOT EXISTS whats_included text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS mount_compatibility text DEFAULT '',
  ADD COLUMN IF NOT EXISTS assembly_manual_url text,
  ADD COLUMN IF NOT EXISTS specs jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS compare text DEFAULT '';

ALTER TABLE catalog_products ENABLE ROW LEVEL SECURITY;
