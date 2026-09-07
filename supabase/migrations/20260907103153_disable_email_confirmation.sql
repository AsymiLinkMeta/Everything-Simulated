-- Auto-confirm new sign-ups so email verification is not required
CREATE OR REPLACE FUNCTION public.auto_confirm_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.email_confirmed_at := now();
  NEW.confirmed_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_confirm_email_on_signup ON auth.users;
CREATE TRIGGER auto_confirm_email_on_signup
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_confirm_email();
