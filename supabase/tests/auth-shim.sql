-- Test-only: the bare supabase/postgres image ships a minimal auth schema. GoTrue adds
-- these objects on a real project. Both statements are no-ops when they already exist.
-- Never applied to a real project.
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS email_confirmed_at timestamptz;
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb
$$;
GRANT EXECUTE ON FUNCTION auth.jwt() TO anon, authenticated, service_role;
