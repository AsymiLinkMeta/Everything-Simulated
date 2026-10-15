/*
  # Prebuild price source

  prebuild_prices gains `price_source`:
    'package' - staff set a package price on the prebuild;
    'parts'   - no package price, so the price is the sum of its (all priced) parts;
    NULL      - not priceable (enquire).
  llms.txt and the site say "from" for 'parts' prices, since the parts can be swapped.
  Columns are appended so CREATE OR REPLACE VIEW keeps existing clients working.
*/
CREATE OR REPLACE VIEW public.prebuild_prices WITH (security_invoker = true) AS
SELECT p.id, p.slug, public.prebuild_price_ex_gst(p.id) AS price_ex_gst, p.enquiry_only,
       (p.status = 'published' AND NOT p.enquiry_only AND coalesce(public.prebuild_price_ex_gst(p.id), 0) > 0) AS purchasable,
       CASE WHEN coalesce(p.price_ex_gst, 0) > 0 THEN 'package'
            WHEN public.prebuild_price_ex_gst(p.id) IS NOT NULL THEN 'parts'
       END AS price_source
  FROM public.prebuilds p;
GRANT SELECT ON public.prebuild_prices TO anon, authenticated;
