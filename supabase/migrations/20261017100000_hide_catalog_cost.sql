/*
  # Hide the workshop's cost price from API clients

  catalog_products.cost_ex_gst (what the workshop pays) was readable by anyone with
  the anon key for every published product, and by any signed-in user. Row security
  can't hide a single column, so SELECT is now granted column by column to anon and
  authenticated on everything except cost_ex_gst.

  - Staff read costs through staff_catalog_costs() (SECURITY DEFINER, is_staff()).
  - INSERT/UPDATE privileges are unchanged, so staff can still write the cost.
  - Server code (service role) and SECURITY DEFINER functions are unaffected.
  - New columns added to catalog_products later must be granted explicitly (the
    DO block below can simply be re-run).
*/
REVOKE SELECT ON public.catalog_products FROM anon, authenticated;

DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position) INTO cols
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'catalog_products' AND column_name <> 'cost_ex_gst';
  EXECUTE format('GRANT SELECT (%s) ON public.catalog_products TO anon, authenticated', cols);
END $$;

CREATE OR REPLACE FUNCTION public.staff_catalog_costs()
RETURNS TABLE (sku text, cost_ex_gst integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN QUERY SELECT c.sku::text, c.cost_ex_gst::integer FROM catalog_products c ORDER BY c.sku;
END $$;
REVOKE ALL ON FUNCTION public.staff_catalog_costs() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.staff_catalog_costs() TO authenticated;
