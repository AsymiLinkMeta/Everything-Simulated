-- Customer quotes are repriced from the database again.
-- price_customer_quote() (20261015130000_server_pricing.sql) is SECURITY DEFINER and tested
-- current_user, which inside a definer function is the owner, never 'anon'/'authenticated'. So the
-- trigger returned early for everyone and a customer could save a quote with any total_ex_gst
-- (verified on prod 2026-11-10 in a rolled-back transaction: an SR2 quote saved at total 1).
-- Same body, only the caller test changes. NOT applied to prod: needs Patrick's OK.
CREATE OR REPLACE FUNCTION public.price_customer_quote()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE q jsonb;
BEGIN
  -- SECURITY DEFINER makes current_user the owner, so the old current_user test never matched and
  -- customer quotes kept whatever total the browser sent. Key off the caller's JWT role instead.
  IF coalesce(auth.jwt() ->> 'role', '') NOT IN ('anon', 'authenticated') OR public.is_staff() THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.lines IS NOT DISTINCT FROM OLD.lines AND NEW.postcode IS NOT DISTINCT FROM OLD.postcode
     AND NEW.total_ex_gst IS NOT DISTINCT FROM OLD.total_ex_gst AND NEW.check_ok IS NOT DISTINCT FROM OLD.check_ok THEN
    RETURN NEW;
  END IF;
  q := public.quote_cart(coalesce(NEW.lines, '[]'::jsonb), NEW.postcode, NULL, NULL);
  NEW.total_ex_gst := (q->>'items_ex_gst')::int;
  NEW.check_ok := (q->>'ok')::boolean;
  RETURN NEW;
END $function$;
