-- Hotfix (applied to prod 2026-10-15 as version 20261015001706): stop self-promotion to admin and
-- stop auto-confirming new sign-ups. Idempotent; safe to replay after
-- 20261014000000_security_hardening (keeps the same semantics: only
-- API callers -- the anon/authenticated roles -- are restricted; service_role,
-- postgres and SECURITY DEFINER helpers such as promote_admin are not).

CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.role := 'customer';
  ELSIF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Role change not allowed';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_profile_role() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS protect_profile_role ON public.profiles;
CREATE TRIGGER protect_profile_role
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_role();

DROP TRIGGER IF EXISTS auto_confirm_email_on_signup ON auth.users;

DO $$
BEGIN
  IF to_regprocedure('public.auto_confirm_email()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.auto_confirm_email() FROM PUBLIC, anon, authenticated;
  END IF;
END $$;
