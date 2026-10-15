-- Security hardening (audit, Oct 2026)
--
-- 1. Re-enable email confirmation: drop the trigger that auto-confirmed every sign-up.
--    Also turn ON "Confirm email" in Supabase Dashboard → Authentication → Providers → Email.
-- 2. Replace "the first account to sign up becomes admin" with an explicit allowlist:
--    public.admin_bootstrap_emails. A signed-in user whose *verified* auth email is on
--    the list is promoted to admin by bootstrap_profile(). Nobody else ever is.
--    Seed it from the SQL editor (see docs/ENV.md → "Admin bootstrap"):
--        insert into public.admin_bootstrap_emails (email) values ('owner@example.com');
--    or promote an existing account directly:  select public.promote_admin('owner@example.com');
-- 3. public.stripe_events: one row per processed Stripe event id (webhook idempotency).

-- 1 ------------------------------------------------------------------------
DROP TRIGGER IF EXISTS auto_confirm_email_on_signup ON auth.users;
DROP FUNCTION IF EXISTS public.auto_confirm_email();

-- 2 ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_bootstrap_emails (
  email text PRIMARY KEY CHECK (email = lower(email) AND position('@' in email) > 1),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_bootstrap_emails ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: only the SQL editor / service role can read or write it.
REVOKE ALL ON public.admin_bootstrap_emails FROM anon, authenticated;

-- Role changes stay admin-only for API callers (anon / authenticated). The trigger now
-- runs as SECURITY INVOKER, so current_user is the real caller: inside trusted
-- SECURITY DEFINER functions (bootstrap_profile, promote_admin) or the SQL editor it is
-- the owner role, and the change is allowed. There is no client-settable bypass.
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role
     AND current_user IN ('anon', 'authenticated') THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()::text AND role = 'admin'
    ) THEN
      RAISE EXCEPTION 'Role change not allowed';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_bootstrap_admin(p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    JOIN public.admin_bootstrap_emails a ON a.email = lower(u.email)
    WHERE u.id = p_uid
      AND u.email_confirmed_at IS NOT NULL
  );
$$;
REVOKE ALL ON FUNCTION public.is_bootstrap_admin(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.bootstrap_profile(p_email text DEFAULT NULL, p_name text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.profiles;
  v_promote boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  -- p_email is client-supplied and only ever used as a display value.
  -- Promotion is decided from the verified auth.users email.
  v_promote := public.is_bootstrap_admin(v_uid);

  SELECT * INTO v_row FROM public.profiles WHERE user_id = v_uid::text;
  IF FOUND THEN
    IF v_promote AND v_row.role <> 'admin' THEN
      UPDATE public.profiles SET role = 'admin' WHERE user_id = v_uid::text;
    END IF;
    UPDATE public.profiles
      SET email = COALESCE(NULLIF(p_email, ''), email),
          display_name = COALESCE(NULLIF(p_name, ''), display_name)
      WHERE user_id = v_uid::text
      RETURNING * INTO v_row;
    RETURN to_jsonb(v_row);
  END IF;

  INSERT INTO public.profiles (user_id, email, display_name, role)
  VALUES (
    v_uid::text,
    NULLIF(p_email, ''),
    NULLIF(p_name, ''),
    CASE WHEN v_promote THEN 'admin' ELSE 'customer' END
  )
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;
REVOKE ALL ON FUNCTION public.bootstrap_profile(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bootstrap_profile(text, text) TO authenticated;

-- Operator tool for the SQL editor: promote an existing account by email.
CREATE OR REPLACE FUNCTION public.promote_admin(p_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = lower(p_email);
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No auth user with email %', p_email;
  END IF;
  INSERT INTO public.profiles (user_id, email, role)
  VALUES (v_uid::text, lower(p_email), 'admin')
  ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
  RETURN v_uid::text;
END;
$$;
REVOKE ALL ON FUNCTION public.promote_admin(text) FROM PUBLIC, anon, authenticated;

-- 3 ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stripe_events (
  id text PRIMARY KEY,
  type text NOT NULL,
  order_id text,
  received_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stripe_events FROM anon, authenticated;
DROP POLICY IF EXISTS "staff_select_stripe_events" ON public.stripe_events;
CREATE POLICY "staff_select_stripe_events" ON public.stripe_events FOR SELECT
  TO authenticated USING (public.is_staff());
GRANT SELECT ON public.stripe_events TO authenticated;
