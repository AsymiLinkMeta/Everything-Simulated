-- Normalize prebuild slugs, seed full crate BOMs, let staff confirm bookings,
-- allow guest jobs, and make quote conversion write a complete order.

UPDATE prebuilds SET slug = 'starter' WHERE slug IN ('starter-rig', 'starter');
UPDATE prebuilds SET slug = 'haptic' WHERE slug IN ('haptic-racing-simulator', 'haptic');
UPDATE prebuilds SET slug = 'motion' WHERE slug IN ('motion-racing-simulator', 'motion');

INSERT INTO prebuilds (slug, name, kicker, blurb, price_ex_gst, image, featured, status)
SELECT 'starter', 'Starter Rig', 'Entry', 'A solid first serious setup.', 1126000, '/rigs/starter.jpg', false, 'published'
WHERE NOT EXISTS (SELECT 1 FROM prebuilds WHERE slug = 'starter');

INSERT INTO prebuilds (slug, name, kicker, blurb, price_ex_gst, image, featured, status)
SELECT 'haptic', 'Haptic Racing Simulator', 'Most popular', 'Balanced immersive build.', 1899900, '/rigs/haptic.jpg', true, 'published'
WHERE NOT EXISTS (SELECT 1 FROM prebuilds WHERE slug = 'haptic');

INSERT INTO prebuilds (slug, name, kicker, blurb, price_ex_gst, image, featured, status)
SELECT 'motion', 'Motion Racing Simulator', 'Flagship', 'SR2 motion on Exodus XR1.', 2899900, '/rigs/motion.jpg', false, 'published'
WHERE NOT EXISTS (SELECT 1 FROM prebuilds WHERE slug = 'motion');

DELETE FROM prebuild_components
WHERE prebuild_id IN (SELECT id FROM prebuilds WHERE slug IN ('starter', 'haptic', 'motion'));

INSERT INTO prebuild_components (prebuild_id, sku, qty, sort_order)
SELECT p.id, x.sku, x.qty, x.sort_order
FROM prebuilds p
JOIN (VALUES
  ('starter','tr120s',1,1),
  ('starter','alpha-evo-12',1,2),
  ('starter','gt-neo',1,3),
  ('starter','p1000',1,4),
  ('starter','seq-shifter',1,5),
  ('starter','handbrake',1,6),
  ('starter','pc-race',1,7),
  ('starter','aoc-32',3,8),
  ('starter','logi-surround',1,9),
  ('starter','side-mount',1,10),
  ('haptic','xr1',1,1),
  ('haptic','quad-mount',1,2),
  ('haptic','touring-seat',1,3),
  ('haptic','alpha-15',1,4),
  ('haptic','gt-neo',1,5),
  ('haptic','p1000-haptic',1,6),
  ('haptic','seq-shifter',1,7),
  ('haptic','aoc-32',3,8),
  ('haptic','aux-27',1,9),
  ('haptic','logi-surround',1,10),
  ('haptic','pro-x',1,11),
  ('haptic','iracing-12',1,12),
  ('haptic','pc-race',1,13),
  ('motion','xr1',1,1),
  ('motion','quad-mount',1,2),
  ('motion','touring-seat',1,3),
  ('motion','alpha-15',1,4),
  ('motion','gt-neo',1,5),
  ('motion','p1000-haptic',1,6),
  ('motion','seq-shifter',1,7),
  ('motion','aoc-32',3,8),
  ('motion','aux-27',1,9),
  ('motion','logi-surround',1,10),
  ('motion','pro-x',1,11),
  ('motion','iracing-12',1,12),
  ('motion','pc-race',1,13),
  ('motion','sr2',1,14)
) AS x(slug, sku, qty, sort_order) ON x.slug = p.slug;

DROP POLICY IF EXISTS "staff_update_bookings" ON bookings;
CREATE POLICY "staff_update_bookings" ON bookings FOR UPDATE
  TO authenticated
  USING (is_staff())
  WITH CHECK (is_staff());

DROP POLICY IF EXISTS "staff_select_bookings" ON bookings;
CREATE POLICY "staff_select_bookings" ON bookings FOR SELECT
  TO authenticated
  USING (is_staff() OR user_id = auth.uid()::text);

ALTER TABLE jobs ALTER COLUMN user_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS jobs_order_id_uidx ON jobs (order_id) WHERE order_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.on_shop_order_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO staff_alerts (kind, title, body, href)
  VALUES (
    'order',
    'New order ' || NEW.id,
    coalesce(NEW.shipping_name, 'Customer') || ' · ' || coalesce(NEW.status, 'pending'),
    '/staff/oms/' || NEW.id
  );
  INSERT INTO pipeline_alerts (order_id, kind, message)
  VALUES (
    NEW.id,
    'new_order',
    coalesce(NEW.shipping_name, 'Customer') || ' placed ' || NEW.id
  );
  IF NOT EXISTS (SELECT 1 FROM jobs WHERE order_id = NEW.id) THEN
    INSERT INTO jobs (user_id, order_id, quote_id, stage, notes)
    VALUES (NEW.user_id, NEW.id, NEW.quote_id, 'enquiry', 'From order ' || NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION convert_quote_to_order(p_quote_id text)
RETURNS TABLE(order_id text, job_id integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote RECORD;
  v_order_id text;
  v_job_id integer;
  v_is_staff boolean;
  v_contact_id uuid;
  v_name text;
BEGIN
  SELECT is_staff() INTO v_is_staff;
  IF NOT v_is_staff THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;

  SELECT q.id, q.user_id, q.lines, q.total_ex_gst, q.postcode, p.display_name, p.email
    INTO v_quote
    FROM quotes q
    LEFT JOIN profiles p ON p.user_id = q.user_id
    WHERE q.id = p_quote_id
    LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found';
  END IF;

  v_name := coalesce(v_quote.display_name, v_quote.email, 'Customer');
  v_order_id := 'ESO-' || upper(to_hex(extract(epoch from now())::bigint));

  SELECT id INTO v_contact_id FROM crm_contacts WHERE user_id = v_quote.user_id LIMIT 1;

  INSERT INTO shop_orders (
    id, user_id, contact_id, quote_id, status, lines,
    total_ex_gst, total_inc_gst, shipping_name, postcode, notes
  )
  VALUES (
    v_order_id,
    v_quote.user_id,
    v_contact_id,
    v_quote.id,
    'pending',
    v_quote.lines,
    v_quote.total_ex_gst,
    round(v_quote.total_ex_gst * 1.1),
    v_name,
    v_quote.postcode,
    'Converted from quote ' || v_quote.id
  );

  INSERT INTO jobs (user_id, quote_id, order_id, stage, notes)
  VALUES (v_quote.user_id, v_quote.id, v_order_id, 'enquiry', 'Auto-created from quote conversion')
  RETURNING id INTO v_job_id;

  UPDATE quotes SET status = 'won', updated_at = now()
    WHERE id = p_quote_id;

  INSERT INTO pipeline_alerts (order_id, kind, message)
  VALUES (v_order_id, 'new_order', 'New order ' || v_order_id || ' from quote ' || p_quote_id);

  RETURN QUERY SELECT v_order_id, v_job_id;
END;
$$;
