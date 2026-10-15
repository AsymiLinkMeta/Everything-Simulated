-- Server-side pricing and order flow.
--
-- The database is the single source of truth for every price a customer can
-- be charged. Browsers send SKUs and quantities only; `quote_cart` prices them
-- from catalog_products / product_overrides / prebuilds / freight config and
-- `place_order` writes the order with those totals. Direct client inserts into
-- shop_orders, crm_contacts, jobs and pipeline_alerts are removed.
--
-- Also in here:
--   * enquiry-only products and prebuilds, and a publish guard against $0
--   * freight zones and pricing settings moved out of the frontend bundle
--   * staff order RPCs: payments, status transitions, shipping, atomic stock
--   * sequential invoice numbers, assigned once
--   * soft-archive of near-duplicate prebuilds (reversible, see bottom)

------------------------------------------------------------------------------
-- 1. Columns
------------------------------------------------------------------------------
ALTER TABLE public.catalog_products ADD COLUMN IF NOT EXISTS enquiry_only boolean NOT NULL DEFAULT false;
ALTER TABLE public.prebuilds ADD COLUMN IF NOT EXISTS enquiry_only boolean NOT NULL DEFAULT false;
ALTER TABLE public.prebuilds ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.prebuilds ADD COLUMN IF NOT EXISTS archived_reason text;

ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS prebuild_slug text;
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS items_ex_gst integer;
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS freight_ex_gst integer;
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS gst_cents integer;
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS priced_lines jsonb;
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS stock_committed boolean NOT NULL DEFAULT false;
UPDATE public.shop_orders SET stock_committed = true
 WHERE NOT stock_committed AND (packed_at IS NOT NULL OR status IN ('packing', 'shipped', 'delivered'));

COMMENT ON COLUMN public.shop_orders.total_ex_gst IS 'Items + freight, ex GST (orders placed via place_order). Older rows may hold items only.';
COMMENT ON COLUMN public.shop_orders.items_ex_gst IS 'Goods ex GST, freight excluded. Basis for ambassador commission.';

------------------------------------------------------------------------------
-- 2. Pricing settings and freight zones (were hardcoded in src/lib/es/freight.ts)
------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pricing_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pricing_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS public_read_pricing_settings ON public.pricing_settings;
CREATE POLICY public_read_pricing_settings ON public.pricing_settings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS admin_write_pricing_settings ON public.pricing_settings;
CREATE POLICY admin_write_pricing_settings ON public.pricing_settings FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

INSERT INTO public.pricing_settings (key, value, description) VALUES
  ('gst_rate', '0.1', 'GST as a fraction'),
  ('freight_included_kg', '40', 'Crate weight included in the zone base rate'),
  ('freight_min_kg', '8', 'Minimum billable crate weight'),
  ('freight_empty_kg', '40', 'Weight assumed when no line has a weight'),
  ('freight_fallback_kg', '8', 'Per-item kg when neither product nor category has one'),
  ('freight_motion_crate_cents', '14500', 'Extra motion crate, outside the local zone'),
  ('freight_motion_crate_local_cents', '8500', 'Extra motion crate, local zone'),
  ('freight_screen_crate_cents', '6500', 'Extra screen crate'),
  ('freight_screen_crate_min_monitors', '3', 'Monitors that trigger a screen crate'),
  ('freight_multi_crate_cents', '2500', 'Handling per extra crate outside the local zone'),
  ('freight_origin_postcode', '"4215"', 'Dispatch postcode shown to customers'),
  ('freight_category_kg', '{"chassis":28,"wheelbase":8,"wheel":3,"pedals":10,"shifter":3,"handbrake":2,"seat":14,"motion":48,"monitor":7,"mount":18,"pc":12,"audio":6,"headset":1,"software":0,"adapter":2,"accessory":3}', 'Default kg per category when a product has no weight')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.freight_zones (
  id text PRIMARY KEY,
  name text NOT NULL,
  ranges jsonb NOT NULL DEFAULT '[]'::jsonb, -- [[lo, hi], ...] inclusive postcode ranges
  base_cents integer NOT NULL CHECK (base_cents >= 0),
  per_kg_cents integer NOT NULL CHECK (per_kg_cents >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  is_fallback boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.freight_zones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS public_read_freight_zones ON public.freight_zones;
CREATE POLICY public_read_freight_zones ON public.freight_zones FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS admin_write_freight_zones ON public.freight_zones;
CREATE POLICY admin_write_freight_zones ON public.freight_zones FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE UNIQUE INDEX IF NOT EXISTS freight_zones_one_fallback ON public.freight_zones (is_fallback) WHERE is_fallback;

INSERT INTO public.freight_zones (id, name, ranges, base_cents, per_kg_cents, sort_order, is_fallback) VALUES
  ('gold-coast', 'Gold Coast', '[[4200,4299]]', 0, 0, 10, false),
  ('seq', 'SEQ', '[[4000,4349],[4500,4579]]', 14500, 80, 20, false),
  ('northern-nsw', 'Northern NSW', '[[2400,2499]]', 18500, 90, 30, false),
  ('act', 'ACT', '[[2600,2639],[2900,2920]]', 25500, 110, 40, false),
  ('nsw', 'Sydney / NSW', '[[2000,2999]]', 24500, 110, 50, false),
  ('vic', 'Melbourne / VIC', '[[3000,3999]]', 26500, 120, 60, false),
  ('sa', 'Adelaide / SA', '[[5000,5999]]', 28500, 130, 70, false),
  ('wa', 'Perth / WA', '[[6000,6999]]', 32000, 160, 80, false),
  ('tas', 'Tasmania', '[[7000,7999]]', 34000, 170, 90, false),
  ('nt', 'Darwin / NT', '[[800,899]]', 39000, 190, 100, false),
  ('australia', 'Australia', '[]', 29500, 130, 1000, true)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.pricing_setting(p_key text, p_default jsonb)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT value FROM public.pricing_settings WHERE key = p_key), p_default);
$$;

------------------------------------------------------------------------------
-- 3. Effective prices. Overrides are the sell price, so they are public.
------------------------------------------------------------------------------
DROP POLICY IF EXISTS public_read_published_overrides ON public.product_overrides;
CREATE POLICY public_read_published_overrides ON public.product_overrides FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.catalog_products c WHERE c.sku = product_overrides.sku AND c.listing_status = 'published'));

CREATE OR REPLACE VIEW public.catalog_prices WITH (security_invoker = true) AS
SELECT c.sku,
       c.sell_ex_gst AS base_ex_gst,
       o.sell_ex_gst AS override_ex_gst,
       coalesce(o.sell_ex_gst, c.sell_ex_gst) AS price_ex_gst,
       c.enquiry_only,
       c.listing_status,
       (c.listing_status = 'published' AND NOT c.enquiry_only AND coalesce(o.sell_ex_gst, c.sell_ex_gst) > 0) AS purchasable
  FROM public.catalog_products c
  LEFT JOIN public.product_overrides o ON o.sku = c.sku;
GRANT SELECT ON public.catalog_prices TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.effective_price_ex_gst(p_sku text)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(o.sell_ex_gst, c.sell_ex_gst)
    FROM public.catalog_products c LEFT JOIN public.product_overrides o ON o.sku = c.sku
   WHERE c.sku = p_sku;
$$;

-- A prebuild's price: its own package price, else the sum of its parts when
-- every part has a price. NULL means it can only be sold by enquiry.
CREATE OR REPLACE FUNCTION public.prebuild_price_ex_gst(p_prebuild uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH pb AS (SELECT price_ex_gst FROM public.prebuilds WHERE id = p_prebuild),
  parts AS (
    SELECT count(*) AS n,
           count(*) FILTER (WHERE coalesce(public.effective_price_ex_gst(pc.sku), 0) <= 0) AS unpriced,
           sum(pc.qty * coalesce(public.effective_price_ex_gst(pc.sku), 0)) AS total
      FROM public.prebuild_components pc WHERE pc.prebuild_id = p_prebuild
  )
  SELECT CASE
           WHEN (SELECT price_ex_gst FROM pb) > 0 THEN (SELECT price_ex_gst FROM pb)
           WHEN parts.n > 0 AND parts.unpriced = 0 THEN parts.total::integer
           ELSE NULL
         END
    FROM parts;
$$;

CREATE OR REPLACE VIEW public.prebuild_prices WITH (security_invoker = true) AS
SELECT p.id, p.slug, public.prebuild_price_ex_gst(p.id) AS price_ex_gst, p.enquiry_only,
       (p.status = 'published' AND NOT p.enquiry_only AND coalesce(public.prebuild_price_ex_gst(p.id), 0) > 0) AS purchasable
  FROM public.prebuilds p;
GRANT SELECT ON public.prebuild_prices TO anon, authenticated;

------------------------------------------------------------------------------
-- 4. Data fixes, before the guards go on
------------------------------------------------------------------------------
-- Published products with no price anywhere become enquiry-only (they were
-- selling at $0). Today: livery, pc-starter, iracing-skin.
UPDATE public.catalog_products c SET enquiry_only = true, updated_at = now()
 WHERE c.listing_status = 'published' AND NOT c.enquiry_only
   AND coalesce((SELECT o.sell_ex_gst FROM public.product_overrides o WHERE o.sku = c.sku), c.sell_ex_gst) <= 0;

-- Prebuilds with price_ex_gst = 0 are priced as the sum of their parts by
-- prebuild_price_ex_gst() (Starter today). No prices are invented here.

------------------------------------------------------------------------------
-- 5. Publish guards
------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_catalog_publish()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.listing_status = 'published' AND NOT NEW.enquiry_only
     AND coalesce((SELECT o.sell_ex_gst FROM public.product_overrides o WHERE o.sku = NEW.sku), NEW.sell_ex_gst) <= 0 THEN
    RAISE EXCEPTION 'Set a price above $0 or mark % as enquiry-only before publishing', NEW.sku USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_catalog_publish ON public.catalog_products;
CREATE TRIGGER guard_catalog_publish BEFORE INSERT OR UPDATE ON public.catalog_products
  FOR EACH ROW EXECUTE FUNCTION public.guard_catalog_publish();

CREATE OR REPLACE FUNCTION public.guard_override_price()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE r record;
BEGIN
  IF TG_OP <> 'DELETE' AND NEW.sell_ex_gst IS NOT NULL AND NEW.sell_ex_gst <= 0 THEN
    RAISE EXCEPTION 'Price override for % must be above $0', NEW.sku USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN
    SELECT listing_status, enquiry_only, sell_ex_gst INTO r FROM public.catalog_products WHERE sku = OLD.sku;
    IF FOUND AND r.listing_status = 'published' AND NOT r.enquiry_only AND r.sell_ex_gst <= 0 THEN
      RAISE EXCEPTION '% is published with no base price; set one before removing the override', OLD.sku USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_override_price ON public.product_overrides;
CREATE TRIGGER guard_override_price BEFORE INSERT OR UPDATE OR DELETE ON public.product_overrides
  FOR EACH ROW EXECUTE FUNCTION public.guard_override_price();

CREATE OR REPLACE FUNCTION public.guard_prebuild_publish()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'published' AND NOT NEW.enquiry_only THEN
    IF coalesce(NEW.price_ex_gst, 0) <= 0
       AND (TG_OP = 'INSERT' OR coalesce(public.prebuild_price_ex_gst(NEW.id), 0) <= 0) THEN
      RAISE EXCEPTION 'Set a package price, price every part, or mark "%" as enquiry-only before publishing', NEW.name
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  IF NEW.status = 'archived' AND NEW.archived_at IS NULL THEN NEW.archived_at := now(); END IF;
  IF NEW.status <> 'archived' THEN NEW.archived_at := NULL; NEW.archived_reason := NULL; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_prebuild_publish ON public.prebuilds;
CREATE TRIGGER guard_prebuild_publish BEFORE INSERT OR UPDATE ON public.prebuilds
  FOR EACH ROW EXECUTE FUNCTION public.guard_prebuild_publish();

------------------------------------------------------------------------------
-- 6. quote_cart: the only pricing engine
------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.quote_cart(
  p_lines jsonb,
  p_postcode text DEFAULT NULL,
  p_prebuild text DEFAULT NULL,
  p_driver_kg integer DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_unique text[] := ARRAY['chassis','wheelbase','wheel','pedals','shifter','handbrake','motion','pc','seat'];
  v_cat_kg jsonb := public.pricing_setting('freight_category_kg', '{}');
  v_fallback_kg numeric := (public.pricing_setting('freight_fallback_kg', '8'))::text::numeric;
  v_gst numeric := (public.pricing_setting('gst_rate', '0.1'))::text::numeric;
  v_norm jsonb;
  v_issues jsonb := '[]'::jsonb;
  v_lines jsonb := '[]'::jsonb;
  v_items bigint := 0;
  v_kg numeric := 0;
  v_lead_min int := 0; v_lead_max int := 0;
  v_mode text := 'parts';
  v_pb_slug text;
  v_pb record;
  v_pb_price int;
  v_package_ex bigint := NULL;
  v_has_motion boolean := false;
  v_monitors int := 0;
  r record;
  v_zone record;
  v_pc int;
  v_billable_kg int;
  v_crates int;
  v_breakdown jsonb := '[]'::jsonb;
  v_freight bigint := 0;
  v_label text;
  v_total_ex bigint;
  v_payload numeric;
  v_motion_payload int;
  v_has_chassis boolean := false;
BEGIN
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' THEN
    RAISE EXCEPTION 'lines must be an array' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object('sku', sku, 'qty', qty)), '[]'::jsonb) INTO v_norm FROM (
    SELECT left(trim(l->>'sku'), 80) AS sku, least(50, sum((l->>'qty')::int))::int AS qty
      FROM jsonb_array_elements(p_lines) l
     WHERE jsonb_typeof(l) = 'object' AND coalesce(trim(l->>'sku'), '') <> ''
       AND (l->>'qty') ~ '^[0-9]{1,4}$' AND (l->>'qty')::int > 0
     GROUP BY 1) n;

  IF jsonb_array_length(v_norm) > 60 THEN
    RAISE EXCEPTION 'Too many lines' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Unmodified prebuild: charged at the package price.
  IF coalesce(p_prebuild, '') <> '' THEN
    SELECT p.id, p.slug, p.name, p.enquiry_only INTO v_pb
      FROM public.prebuilds p WHERE p.slug = p_prebuild AND p.status = 'published';
    IF FOUND THEN
      v_pb_price := public.prebuild_price_ex_gst(v_pb.id);
      IF NOT EXISTS (
           (SELECT sku, sum(qty)::int FROM public.prebuild_components WHERE prebuild_id = v_pb.id GROUP BY sku)
           EXCEPT SELECT sku, qty FROM jsonb_to_recordset(v_norm) AS l(sku text, qty int))
         AND NOT EXISTS (
           SELECT sku, qty FROM jsonb_to_recordset(v_norm) AS l(sku text, qty int)
           EXCEPT (SELECT sku, sum(qty)::int FROM public.prebuild_components WHERE prebuild_id = v_pb.id GROUP BY sku))
         AND EXISTS (SELECT 1 FROM jsonb_to_recordset(v_norm) AS l(sku text, qty int)) THEN
        v_mode := 'package';
        v_pb_slug := v_pb.slug;
        IF v_pb.enquiry_only OR coalesce(v_pb_price, 0) <= 0 THEN
          v_issues := v_issues || jsonb_build_object('code', 'ENQUIRY_PREBUILD', 'severity', 'block',
            'message', v_pb.name || ' is priced on enquiry. Send us the build and we will quote it.');
        ELSE
          v_package_ex := v_pb_price;
        END IF;
      END IF;
    END IF;
  END IF;

  FOR r IN
    SELECT l.sku, l.qty, c.name, c.category, c.listing_status, c.enquiry_only,
           coalesce(o.sell_ex_gst, c.sell_ex_gst) AS price, c.weight_kg, c.payload_kg,
           c.lead_weeks_min, c.lead_weeks_max, (c.sku IS NOT NULL) AS known
      FROM jsonb_to_recordset(v_norm) AS l(sku text, qty int)
      LEFT JOIN public.catalog_products c ON c.sku = l.sku
      LEFT JOIN public.product_overrides o ON o.sku = l.sku
     ORDER BY l.sku
  LOOP
    IF NOT r.known OR r.listing_status <> 'published' THEN
      v_issues := v_issues || jsonb_build_object('code', 'UNKNOWN_SKU', 'severity', 'block', 'sku', r.sku,
        'message', r.sku || ' is not in the catalogue.');
      CONTINUE;
    END IF;
    IF v_mode = 'parts' AND (r.enquiry_only OR coalesce(r.price, 0) <= 0) THEN
      v_issues := v_issues || jsonb_build_object('code', 'ENQUIRY_ONLY', 'severity', 'block', 'sku', r.sku,
        'message', r.name || ' is priced on enquiry. Remove it to order online, or send us the build.');
    END IF;
    v_lines := v_lines || jsonb_build_object(
      'sku', r.sku, 'qty', r.qty, 'name', r.name, 'category', r.category,
      'unit_ex_gst', CASE WHEN v_mode = 'package' THEN 0 ELSE coalesce(r.price, 0) END,
      'line_ex_gst', CASE WHEN v_mode = 'package' THEN 0 ELSE coalesce(r.price, 0) * r.qty END,
      'included', v_mode = 'package');
    IF v_mode = 'parts' THEN v_items := v_items + coalesce(r.price, 0)::bigint * r.qty; END IF;
    v_kg := v_kg + r.qty * coalesce(nullif(r.weight_kg, 0)::numeric,
                                    (v_cat_kg ->> r.category)::numeric, v_fallback_kg);
    v_lead_min := greatest(v_lead_min, r.lead_weeks_min);
    v_lead_max := greatest(v_lead_max, r.lead_weeks_max);
    IF r.category = 'motion' THEN v_has_motion := true; v_motion_payload := r.payload_kg; END IF;
    IF r.category = 'chassis' THEN v_has_chassis := true; END IF;
    IF r.category = 'monitor' THEN v_monitors := v_monitors + r.qty; END IF;
  END LOOP;

  IF v_mode = 'package' THEN v_items := coalesce(v_package_ex, 0); END IF;

  -- One of each unique category.
  FOR r IN
    SELECT c.category, string_agg(c.name, ', ' ORDER BY c.name) AS names
      FROM jsonb_to_recordset(v_norm) AS l(sku text, qty int) JOIN public.catalog_products c ON c.sku = l.sku
     WHERE c.category = ANY (v_unique)
     GROUP BY c.category HAVING count(*) > 1
  LOOP
    v_issues := v_issues || jsonb_build_object('code', 'MULTI_' || upper(r.category), 'severity', 'block',
      'message', 'A build can only have one ' || r.category || ' (' || r.names || ').');
  END LOOP;

  -- Blocking compatibility rules.
  FOR r IN
    SELECT cr.id, cr.reason FROM public.compatibility_rules cr
     WHERE cr.severity = 'block'
       AND EXISTS (SELECT 1 FROM jsonb_to_recordset(v_norm) AS l(sku text, qty int) WHERE sku = cr.left_sku)
       AND EXISTS (SELECT 1 FROM jsonb_to_recordset(v_norm) AS l(sku text, qty int) WHERE sku = cr.right_sku)
  LOOP
    v_issues := v_issues || jsonb_build_object('code', upper(r.id), 'severity', 'block', 'message', r.reason);
  END LOOP;

  -- Motion payload.
  IF v_has_motion AND v_has_chassis AND v_motion_payload IS NOT NULL THEN
    SELECT coalesce(p_driver_kg, 80) + coalesce(sum(l.qty * coalesce(c.weight_kg, 0)), 0) INTO v_payload
      FROM jsonb_to_recordset(v_norm) AS l(sku text, qty int) JOIN public.catalog_products c ON c.sku = l.sku;
    IF v_payload > v_motion_payload THEN
      v_issues := v_issues || jsonb_build_object('code', 'MOTION_PAYLOAD', 'severity', 'block',
        'message', format('Estimated payload %s kg exceeds the motion rating of %s kg.', round(v_payload), v_motion_payload));
    END IF;
  END IF;

  -- Freight.
  v_pc := nullif(left(regexp_replace(coalesce(p_postcode, ''), '\D', '', 'g'), 4), '')::int;
  SELECT * INTO v_zone FROM public.freight_zones z
   WHERE v_pc IS NOT NULL AND v_pc > 0 AND NOT z.is_fallback
     AND EXISTS (SELECT 1 FROM jsonb_array_elements(z.ranges) rg
                  WHERE v_pc BETWEEN (rg->>0)::int AND (rg->>1)::int)
   ORDER BY z.sort_order LIMIT 1;
  IF NOT FOUND THEN
    SELECT * INTO v_zone FROM public.freight_zones WHERE is_fallback LIMIT 1;
  END IF;

  v_billable_kg := greatest((public.pricing_setting('freight_min_kg', '8'))::text::int,
                            coalesce(nullif(round(v_kg), 0), (public.pricing_setting('freight_empty_kg', '40'))::text::int)::int);
  v_crates := 1 + (CASE WHEN v_has_motion THEN 1 ELSE 0 END)
                + (CASE WHEN v_monitors >= (public.pricing_setting('freight_screen_crate_min_monitors', '3'))::text::int THEN 1 ELSE 0 END);

  IF v_zone.base_cents = 0 AND NOT v_has_motion THEN
    v_freight := 0; v_crates := 1;
    v_label := v_zone.name || ' collection / local drop, no crate';
    v_breakdown := jsonb_build_array(jsonb_build_object('label', 'Local ' || v_zone.name, 'cents', 0));
  ELSE
    v_breakdown := jsonb_build_array(jsonb_build_object('label', v_zone.name || ' crate', 'cents', v_zone.base_cents));
    IF v_billable_kg > (public.pricing_setting('freight_included_kg', '40'))::text::int AND v_zone.per_kg_cents > 0 THEN
      v_breakdown := v_breakdown || jsonb_build_object(
        'label', format('Weight %s kg (first %s included)', v_billable_kg, public.pricing_setting('freight_included_kg', '40')),
        'cents', (v_billable_kg - (public.pricing_setting('freight_included_kg', '40'))::text::int) * v_zone.per_kg_cents);
    END IF;
    IF v_has_motion THEN
      v_breakdown := v_breakdown || jsonb_build_object('label', 'Motion crate', 'cents',
        CASE WHEN v_zone.base_cents = 0 THEN (public.pricing_setting('freight_motion_crate_local_cents', '8500'))::text::int
             ELSE (public.pricing_setting('freight_motion_crate_cents', '14500'))::text::int END);
    END IF;
    IF v_monitors >= (public.pricing_setting('freight_screen_crate_min_monitors', '3'))::text::int THEN
      v_breakdown := v_breakdown || jsonb_build_object('label', 'Screen crate',
        'cents', (public.pricing_setting('freight_screen_crate_cents', '6500'))::text::int);
    END IF;
    IF v_crates > 1 AND v_zone.base_cents > 0 THEN
      v_breakdown := v_breakdown || jsonb_build_object('label', format('Multi-crate handling x%s', v_crates),
        'cents', (v_crates - 1) * (public.pricing_setting('freight_multi_crate_cents', '2500'))::text::int);
    END IF;
    SELECT coalesce(sum((b->>'cents')::int), 0) INTO v_freight FROM jsonb_array_elements(v_breakdown) b;
    v_label := v_zone.name || ' crate freight from the Gold Coast';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM jsonb_to_recordset(v_norm) AS l(sku text, qty int)) THEN
    v_issues := v_issues || jsonb_build_object('code', 'EMPTY', 'severity', 'block', 'message', 'Your cart is empty.');
    v_freight := 0;
  END IF;

  v_total_ex := v_items + v_freight;
  RETURN jsonb_build_object(
    'ok', NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_issues) i WHERE i->>'severity' = 'block'),
    'mode', v_mode,
    'prebuild', v_pb_slug,
    'package_ex_gst', v_package_ex,
    'lines', v_lines,
    'items_ex_gst', v_items,
    'freight', jsonb_build_object('cents', v_freight, 'zone', v_zone.name, 'label', v_label,
                                  'kg', v_billable_kg, 'crates', v_crates, 'breakdown', v_breakdown),
    'freight_ex_gst', v_freight,
    'total_ex_gst', v_total_ex,
    'gst_cents', round(v_total_ex * v_gst)::bigint,
    'total_inc_gst', v_total_ex + round(v_total_ex * v_gst)::bigint,
    'lead_weeks', jsonb_build_array(v_lead_min, v_lead_max),
    'issues', v_issues
  );
END $$;

REVOKE ALL ON FUNCTION public.quote_cart(jsonb, text, text, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.quote_cart(jsonb, text, text, integer) TO anon, authenticated, service_role;

------------------------------------------------------------------------------
-- 7. Totals on orders and quotes can only be written by the pricing RPCs
------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_order_totals()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN RETURN NEW; END IF;
  IF coalesce(current_setting('es.pricing_rpc', true), '') = 'on' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'Orders are created with place_order()' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW.lines IS DISTINCT FROM OLD.lines
     OR NEW.total_ex_gst IS DISTINCT FROM OLD.total_ex_gst
     OR NEW.total_inc_gst IS DISTINCT FROM OLD.total_inc_gst
     OR NEW.items_ex_gst IS DISTINCT FROM OLD.items_ex_gst
     OR NEW.freight_ex_gst IS DISTINCT FROM OLD.freight_ex_gst
     OR NEW.paid_cents IS DISTINCT FROM OLD.paid_cents
     OR NEW.refunded_cents IS DISTINCT FROM OLD.refunded_cents
     OR NEW.invoice_number IS DISTINCT FROM OLD.invoice_number
     OR NEW.referral_code IS DISTINCT FROM OLD.referral_code
     OR NEW.stock_committed IS DISTINCT FROM OLD.stock_committed
     OR NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Order totals, payments and status change through the order RPCs' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_order_totals ON public.shop_orders;
CREATE TRIGGER guard_order_totals BEFORE INSERT OR UPDATE ON public.shop_orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_order_totals();

-- Sequential invoice numbers, assigned once, the first time money lands.
CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq START 1001;
CREATE OR REPLACE FUNCTION public.assign_invoice_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.invoice_number IS NULL AND coalesce(NEW.paid_cents, 0) > 0 THEN
    NEW.invoice_number := 'ESI-' || lpad(nextval('public.invoice_number_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS zz_assign_invoice_number ON public.shop_orders;
-- Named zz_ so it fires after guard_order_totals (triggers fire alphabetically).
CREATE TRIGGER zz_assign_invoice_number BEFORE INSERT OR UPDATE ON public.shop_orders
  FOR EACH ROW EXECUTE FUNCTION public.assign_invoice_number();

-- Customer quotes: totals recomputed from DB prices whatever the browser sent.
CREATE OR REPLACE FUNCTION public.price_customer_quote()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE q jsonb;
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') OR public.is_staff() THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.lines IS NOT DISTINCT FROM OLD.lines AND NEW.postcode IS NOT DISTINCT FROM OLD.postcode
     AND NEW.total_ex_gst IS NOT DISTINCT FROM OLD.total_ex_gst AND NEW.check_ok IS NOT DISTINCT FROM OLD.check_ok THEN
    RETURN NEW;
  END IF;
  q := public.quote_cart(coalesce(NEW.lines, '[]'::jsonb), NEW.postcode, NULL, NULL);
  NEW.total_ex_gst := (q->>'items_ex_gst')::int;
  NEW.check_ok := (q->>'ok')::boolean;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS price_customer_quote ON public.quotes;
CREATE TRIGGER price_customer_quote BEFORE INSERT OR UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.price_customer_quote();

-- No more direct client inserts; place_order does all of this.
DROP POLICY IF EXISTS guest_insert_orders ON public.shop_orders;
DROP POLICY IF EXISTS owner_insert_shop_orders ON public.shop_orders;
DROP POLICY IF EXISTS guest_insert_contacts ON public.crm_contacts;
DROP POLICY IF EXISTS owner_insert_crm_contacts ON public.crm_contacts;
DROP POLICY IF EXISTS insert_own_jobs ON public.jobs;
DROP POLICY IF EXISTS update_own_jobs ON public.jobs;
DROP POLICY IF EXISTS anon_insert_alerts ON public.pipeline_alerts;

------------------------------------------------------------------------------
-- 8. place_order
------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.place_order(p jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid text := auth.uid()::text;
  v_email text;
  v_name text := left(trim(coalesce(p->>'name', '')), 120);
  v_phone text := nullif(left(trim(coalesce(p->>'phone', '')), 40), '');
  v_address text := nullif(left(trim(coalesce(p->>'address', '')), 500), '');
  v_postcode text := nullif(left(regexp_replace(coalesce(p->>'postcode', ''), '\D', '', 'g'), 4), '');
  v_notes text := left(coalesce(p->>'notes', ''), 2000);
  v_quote_id text := nullif(p->>'quote_id', '');
  v_code text := nullif(upper(regexp_replace(coalesce(p->>'referral_code', ''), '[^A-Za-z0-9-]', '', 'g')), '');
  v_referral text;
  v_driver int;
  q jsonb;
  v_block text;
  v_id text;
  v_contact uuid;
  v_recent int;
BEGIN
  IF (p->>'driver_kg') ~ '^[0-9]{2,3}$' THEN v_driver := (p->>'driver_kg')::int; END IF;

  IF v_uid IS NOT NULL THEN
    SELECT lower(email) INTO v_email FROM auth.users WHERE id = auth.uid();
    IF v_name = '' THEN
      SELECT left(coalesce(display_name, ''), 120) INTO v_name FROM public.profiles WHERE user_id = v_uid;
    END IF;
    IF coalesce(v_name, '') = '' THEN v_name := split_part(coalesce(v_email, 'Customer'), '@', 1); END IF;
  ELSE
    v_email := lower(left(trim(coalesce(p->>'email', '')), 200));
    IF v_name = '' THEN RAISE EXCEPTION 'Name is required' USING ERRCODE = 'invalid_parameter_value'; END IF;
    IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
      RAISE EXCEPTION 'A valid email is required' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    SELECT count(*) INTO v_recent FROM public.shop_orders o JOIN public.crm_contacts c ON c.id = o.contact_id
     WHERE o.user_id IS NULL AND lower(c.email) = v_email AND o.created_at > now() - interval '1 hour';
    IF v_recent >= 5 THEN
      RAISE EXCEPTION 'Too many orders from this email in the last hour. Call us and we will sort it out.'
        USING ERRCODE = 'program_limit_exceeded';
    END IF;
  END IF;

  q := public.quote_cart(coalesce(p->'lines', '[]'::jsonb), v_postcode, nullif(p->>'prebuild', ''), v_driver);
  IF NOT (q->>'ok')::boolean THEN
    SELECT i->>'message' INTO v_block FROM jsonb_array_elements(q->'issues') i WHERE i->>'severity' = 'block' LIMIT 1;
    RAISE EXCEPTION 'This build can''t be ordered online yet: %', v_block USING ERRCODE = 'check_violation';
  END IF;
  IF (q->>'items_ex_gst')::bigint <= 0 THEN
    RAISE EXCEPTION 'This build has no price yet. Send it to us as an enquiry.' USING ERRCODE = 'check_violation';
  END IF;

  IF v_code IS NOT NULL THEN
    SELECT code INTO v_referral FROM public.ambassadors WHERE upper(code) = v_code AND published LIMIT 1;
  END IF;

  -- CRM contact
  IF v_uid IS NOT NULL THEN
    SELECT id INTO v_contact FROM public.crm_contacts WHERE user_id = v_uid ORDER BY created_at LIMIT 1;
    IF v_contact IS NULL THEN
      INSERT INTO public.crm_contacts (user_id, display_name, email, phone, postcode, address, crm_stage, crm_source, notes)
      VALUES (v_uid, v_name, v_email, v_phone, v_postcode, v_address, 'quoted', 'website', '')
      RETURNING id INTO v_contact;
    ELSE
      UPDATE public.crm_contacts SET display_name = v_name, email = coalesce(v_email, email),
             phone = coalesce(v_phone, phone), postcode = coalesce(v_postcode, postcode),
             address = coalesce(v_address, address),
             crm_stage = CASE WHEN crm_stage IN ('lead', 'qualified') THEN 'quoted' ELSE crm_stage END
       WHERE id = v_contact;
    END IF;
  ELSE
    -- Reuse an unclaimed guest contact with this email, but never edit it.
    SELECT id INTO v_contact FROM public.crm_contacts
     WHERE user_id IS NULL AND lower(email) = v_email ORDER BY created_at LIMIT 1;
    IF v_contact IS NULL THEN
      INSERT INTO public.crm_contacts (display_name, email, phone, postcode, address, crm_stage, crm_source, notes)
      VALUES (v_name, v_email, v_phone, v_postcode, v_address, 'lead', 'website', '')
      RETURNING id INTO v_contact;
    END IF;
  END IF;

  IF v_quote_id IS NOT NULL AND (v_uid IS NULL OR NOT EXISTS (
       SELECT 1 FROM public.quotes WHERE id = v_quote_id AND user_id = v_uid)) THEN
    v_quote_id := NULL;
  END IF;

  v_id := 'ESO-' || upper(to_hex((extract(epoch FROM clock_timestamp()) * 1000)::bigint)) || '-'
          || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));

  PERFORM set_config('es.pricing_rpc', 'on', true);
  INSERT INTO public.shop_orders (
    id, contact_id, user_id, quote_id, status, lines, priced_lines, prebuild_slug,
    items_ex_gst, freight_ex_gst, total_ex_gst, gst_cents, total_inc_gst,
    shipping_name, shipping_address, postcode, notes, referral_code)
  SELECT v_id, v_contact, v_uid, v_quote_id, 'pending',
         (SELECT jsonb_agg(jsonb_build_object('sku', l->>'sku', 'qty', (l->>'qty')::int)) FROM jsonb_array_elements(q->'lines') l),
         q->'lines', q->>'prebuild',
         (q->>'items_ex_gst')::int, (q->>'freight_ex_gst')::int, (q->>'total_ex_gst')::int,
         (q->>'gst_cents')::int, (q->>'total_inc_gst')::int,
         v_name, v_address, v_postcode, v_notes, v_referral;
  PERFORM set_config('es.pricing_rpc', '', true);

  IF v_quote_id IS NOT NULL THEN
    UPDATE public.quotes SET status = 'won', contact_id = coalesce(contact_id, v_contact), updated_at = now()
     WHERE id = v_quote_id;
  END IF;

  -- The job card and staff alerts come from the shop_orders_alert insert trigger.

  RETURN jsonb_build_object('id', v_id, 'referral_code', v_referral, 'quote', q);
END $$;
REVOKE ALL ON FUNCTION public.place_order(jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.place_order(jsonb) TO anon, authenticated;

------------------------------------------------------------------------------
-- 9. Staff order RPCs
------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.commit_order_stock(p_order text, p_sign int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l record; v_left int;
BEGIN
  FOR l IN SELECT x.sku, sum(x.qty)::int AS qty
             FROM shop_orders o, jsonb_to_recordset(o.lines) AS x(sku text, qty int)
            WHERE o.id = p_order GROUP BY x.sku
  LOOP
    UPDATE catalog_products
       SET qty_on_hand = qty_on_hand - p_sign * l.qty,
           stock_status = CASE WHEN qty_on_hand - p_sign * l.qty <= 0 AND stock_status = 'stock' THEN 'indent' ELSE stock_status END,
           updated_at = now()
     WHERE sku = l.sku
     RETURNING qty_on_hand INTO v_left;
    IF p_sign > 0 AND v_left < 0 THEN
      INSERT INTO pipeline_alerts (order_id, kind, message)
      VALUES (p_order, 'oversold', format('%s is oversold: %s on hand after order %s', l.sku, v_left, p_order));
    END IF;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.commit_order_stock(text, int) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_record_payment(p_order text, p_cents integer, p_note text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o record;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'Staff only' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF p_cents IS NULL OR p_cents <= 0 THEN RAISE EXCEPTION 'Payment must be above $0' USING ERRCODE = 'invalid_parameter_value'; END IF;
  SELECT * INTO o FROM shop_orders WHERE id = p_order FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found' USING ERRCODE = 'no_data_found'; END IF;
  IF o.status = 'cancelled' THEN RAISE EXCEPTION 'Order is cancelled' USING ERRCODE = 'check_violation'; END IF;
  IF o.paid_cents + p_cents > o.total_inc_gst - o.refunded_cents THEN
    RAISE EXCEPTION 'That is more than the % owing', to_char((o.total_inc_gst - o.refunded_cents - o.paid_cents) / 100.0, 'FM$999,999,990.00')
      USING ERRCODE = 'check_violation';
  END IF;
  PERFORM set_config('es.pricing_rpc', 'on', true);
  UPDATE shop_orders SET paid_cents = paid_cents + p_cents,
         status = CASE WHEN status = 'pending' THEN 'paid' ELSE status END,
         notes = CASE WHEN coalesce(p_note, '') = '' THEN notes
                      ELSE trim(both E'\n' FROM notes || E'\n' || format('Payment %s recorded: %s', to_char(p_cents / 100.0, 'FM$999,999,990.00'), left(p_note, 300))) END,
         updated_at = now()
   WHERE id = p_order;
  PERFORM set_config('es.pricing_rpc', '', true);
  RETURN (SELECT jsonb_build_object('id', id, 'status', status, 'paid_cents', paid_cents, 'invoice_number', invoice_number,
                                    'balance_cents', total_inc_gst - refunded_cents - paid_cents)
            FROM shop_orders WHERE id = p_order);
END $$;

CREATE OR REPLACE FUNCTION public.staff_set_order_status(p_order text, p_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o record;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'Staff only' USING ERRCODE = 'insufficient_privilege'; END IF;
  SELECT * INTO o FROM shop_orders WHERE id = p_order FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found' USING ERRCODE = 'no_data_found'; END IF;
  IF o.status = p_status THEN RETURN jsonb_build_object('id', o.id, 'status', o.status, 'unchanged', true); END IF;
  IF p_status = 'paid' AND o.paid_cents <= 0 THEN
    RAISE EXCEPTION 'Record a payment first' USING ERRCODE = 'check_violation';
  ELSIF p_status = 'packing' AND o.status NOT IN ('paid') THEN
    RAISE EXCEPTION 'Only paid orders can be packed (this one is %)', o.status USING ERRCODE = 'check_violation';
  ELSIF p_status = 'shipped' THEN
    RAISE EXCEPTION 'Use Ship with tracking' USING ERRCODE = 'check_violation';
  ELSIF p_status = 'delivered' AND o.status <> 'shipped' THEN
    RAISE EXCEPTION 'Only shipped orders can be delivered' USING ERRCODE = 'check_violation';
  ELSIF p_status = 'pending' AND o.paid_cents > 0 THEN
    RAISE EXCEPTION 'This order has payments; refund them first' USING ERRCODE = 'check_violation';
  ELSIF p_status = 'cancelled' AND o.status = 'delivered' THEN
    RAISE EXCEPTION 'Delivered orders are returned, not cancelled' USING ERRCODE = 'check_violation';
  ELSIF p_status NOT IN ('pending', 'paid', 'packing', 'delivered', 'cancelled') THEN
    RAISE EXCEPTION 'Unknown status %', p_status USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_status = 'packing' AND NOT o.stock_committed THEN PERFORM commit_order_stock(p_order, 1); END IF;
  IF p_status IN ('cancelled', 'pending') AND o.stock_committed THEN PERFORM commit_order_stock(p_order, -1); END IF;

  PERFORM set_config('es.pricing_rpc', 'on', true);
  UPDATE shop_orders SET status = p_status,
         stock_committed = CASE WHEN p_status = 'packing' THEN true WHEN p_status IN ('cancelled', 'pending') THEN false ELSE stock_committed END,
         packed_at = CASE WHEN p_status = 'packing' THEN now() ELSE packed_at END,
         delivered_at = CASE WHEN p_status = 'delivered' THEN now() ELSE delivered_at END,
         updated_at = now()
   WHERE id = p_order;
  PERFORM set_config('es.pricing_rpc', '', true);
  IF p_status = 'delivered' AND o.contact_id IS NOT NULL THEN
    UPDATE crm_contacts SET crm_stage = 'active' WHERE id = o.contact_id;
  END IF;
  RETURN jsonb_build_object('id', p_order, 'status', p_status);
END $$;

CREATE OR REPLACE FUNCTION public.staff_ship_order(p_order text, p_tracking text DEFAULT NULL, p_carrier text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o record; v_tracking text;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'Staff only' USING ERRCODE = 'insufficient_privilege'; END IF;
  SELECT * INTO o FROM shop_orders WHERE id = p_order FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found' USING ERRCODE = 'no_data_found'; END IF;
  IF o.status NOT IN ('paid', 'packing', 'shipped') THEN
    RAISE EXCEPTION 'Only paid orders can ship (this one is %)', o.status USING ERRCODE = 'check_violation';
  END IF;
  v_tracking := nullif(left(trim(coalesce(p_tracking, '')), 60), '');
  IF v_tracking IS NULL THEN
    v_tracking := 'ES' || to_char(now(), 'YYMMDD') || upper(substr(md5(random()::text), 1, 4)) || 'AU';
  END IF;
  IF NOT o.stock_committed THEN PERFORM commit_order_stock(p_order, 1); END IF;
  PERFORM set_config('es.pricing_rpc', 'on', true);
  UPDATE shop_orders SET status = 'shipped', stock_committed = true,
         tracking_number = v_tracking,
         carrier = coalesce(nullif(left(trim(coalesce(p_carrier, '')), 60), ''), carrier, 'ES Crate Freight'),
         packed_at = coalesce(packed_at, now()), shipped_at = coalesce(shipped_at, now()), updated_at = now()
   WHERE id = p_order;
  PERFORM set_config('es.pricing_rpc', '', true);
  RETURN jsonb_build_object('id', p_order, 'status', 'shipped', 'tracking', v_tracking);
END $$;

-- Staff manual orders and line edits, priced by quote_cart like everything else.
CREATE OR REPLACE FUNCTION public.staff_create_order(p_contact uuid, p_lines jsonb, p_quote text DEFAULT NULL, p_notes text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record; q jsonb; v_block text; v_id text;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'Staff only' USING ERRCODE = 'insufficient_privilege'; END IF;
  SELECT * INTO c FROM crm_contacts WHERE id = p_contact;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pick a customer' USING ERRCODE = 'no_data_found'; END IF;
  q := quote_cart(coalesce(p_lines, '[]'::jsonb), c.postcode, NULL, NULL);
  IF NOT (q->>'ok')::boolean THEN
    SELECT i->>'message' INTO v_block FROM jsonb_array_elements(q->'issues') i WHERE i->>'severity' = 'block' LIMIT 1;
    RAISE EXCEPTION 'Can''t create this order: %', v_block USING ERRCODE = 'check_violation';
  END IF;
  v_id := 'ESO-' || upper(to_hex((extract(epoch FROM clock_timestamp()) * 1000)::bigint)) || '-'
          || upper(substr(md5(random()::text), 1, 4));
  PERFORM set_config('es.pricing_rpc', 'on', true);
  INSERT INTO shop_orders (id, contact_id, user_id, quote_id, status, lines, priced_lines,
                           items_ex_gst, freight_ex_gst, total_ex_gst, gst_cents, total_inc_gst,
                           shipping_name, shipping_address, postcode, notes)
  SELECT v_id, c.id, c.user_id, p_quote, 'pending',
         (SELECT jsonb_agg(jsonb_build_object('sku', l->>'sku', 'qty', (l->>'qty')::int)) FROM jsonb_array_elements(q->'lines') l),
         q->'lines', (q->>'items_ex_gst')::int, (q->>'freight_ex_gst')::int, (q->>'total_ex_gst')::int,
         (q->>'gst_cents')::int, (q->>'total_inc_gst')::int, c.display_name, c.address, c.postcode, left(coalesce(p_notes, ''), 2000);
  PERFORM set_config('es.pricing_rpc', '', true);
  UPDATE crm_contacts SET crm_stage = 'quoted' WHERE id = c.id AND crm_stage IN ('lead', 'qualified');
  IF p_quote IS NOT NULL THEN UPDATE quotes SET status = 'won', updated_at = now() WHERE id = p_quote; END IF;
  RETURN jsonb_build_object('id', v_id, 'quote', q);
END $$;

CREATE OR REPLACE FUNCTION public.staff_update_order_lines(p_order text, p_lines jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o record; q jsonb; v_block text;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'Staff only' USING ERRCODE = 'insufficient_privilege'; END IF;
  SELECT * INTO o FROM shop_orders WHERE id = p_order FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found' USING ERRCODE = 'no_data_found'; END IF;
  IF o.stock_committed OR o.status IN ('shipped', 'delivered', 'cancelled') THEN
    RAISE EXCEPTION 'Lines can''t change once an order is packed' USING ERRCODE = 'check_violation';
  END IF;
  q := quote_cart(coalesce(p_lines, '[]'::jsonb), o.postcode, NULL, NULL);
  IF NOT (q->>'ok')::boolean THEN
    SELECT i->>'message' INTO v_block FROM jsonb_array_elements(q->'issues') i WHERE i->>'severity' = 'block' LIMIT 1;
    RAISE EXCEPTION 'Can''t save these lines: %', v_block USING ERRCODE = 'check_violation';
  END IF;
  IF (q->>'total_inc_gst')::int < o.paid_cents THEN
    RAISE EXCEPTION 'New total is below what has been paid' USING ERRCODE = 'check_violation';
  END IF;
  PERFORM set_config('es.pricing_rpc', 'on', true);
  UPDATE shop_orders SET
         lines = (SELECT jsonb_agg(jsonb_build_object('sku', l->>'sku', 'qty', (l->>'qty')::int)) FROM jsonb_array_elements(q->'lines') l),
         priced_lines = q->'lines', prebuild_slug = NULL,
         items_ex_gst = (q->>'items_ex_gst')::int, freight_ex_gst = (q->>'freight_ex_gst')::int,
         total_ex_gst = (q->>'total_ex_gst')::int, gst_cents = (q->>'gst_cents')::int,
         total_inc_gst = (q->>'total_inc_gst')::int, updated_at = now()
   WHERE id = p_order;
  PERFORM set_config('es.pricing_rpc', '', true);
  RETURN jsonb_build_object('id', p_order, 'quote', q);
END $$;

-- Returns: cancel, and put stock back if it had been picked.
CREATE OR REPLACE FUNCTION public.staff_return_order(p_order text, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o record;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'Staff only' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF coalesce(trim(p_reason), '') = '' THEN RAISE EXCEPTION 'Return reason required' USING ERRCODE = 'invalid_parameter_value'; END IF;
  SELECT * INTO o FROM shop_orders WHERE id = p_order FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found' USING ERRCODE = 'no_data_found'; END IF;
  IF o.stock_committed THEN PERFORM commit_order_stock(p_order, -1); END IF;
  PERFORM set_config('es.pricing_rpc', 'on', true);
  UPDATE shop_orders SET status = 'cancelled', stock_committed = false, return_reason = left(trim(p_reason), 500), updated_at = now()
   WHERE id = p_order;
  PERFORM set_config('es.pricing_rpc', '', true);
  RETURN jsonb_build_object('id', p_order, 'status', 'cancelled');
END $$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'staff_record_payment(text, integer, text)', 'staff_set_order_status(text, text)',
    'staff_ship_order(text, text, text)', 'staff_create_order(uuid, jsonb, text, text)',
    'staff_update_order_lines(text, jsonb)', 'staff_return_order(text, text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM public, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;

------------------------------------------------------------------------------
-- 10. Archive near-duplicate prebuilds (soft and reversible)
------------------------------------------------------------------------------
-- Canonical: starter, haptic, motion. Archived here:
--   haptic-racing-rig       (duplicate of haptic)
--   exodus-xr1-full-motion  (duplicate of motion)
--   flagship-rival          (starter-class variant with a clashing "Flagship" kicker)
-- To restore one:
--   UPDATE prebuilds SET status = 'published' WHERE slug = '<slug>';
-- (it needs a package price, or every part priced, to publish again).
UPDATE public.prebuilds
   SET status = 'archived', featured = false, archived_at = now(),
       archived_reason = 'Near-duplicate of a canonical prebuild (starter / haptic / motion), archived 2026-10-15',
       updated_at = now()
 WHERE slug IN ('haptic-racing-rig', 'exodus-xr1-full-motion', 'flagship-rival')
   AND status <> 'archived';
