-- Unify ops: staff-only prebuild writes, tighter guest checkout,
-- order lookup RPC, staff alerts, service tickets, quote→OMS link.

-- ---------------------------------------------------------------------------
-- Prebuilds: staff-only writes (public can still read published rows)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "staff_select_prebuilds" ON prebuilds;
DROP POLICY IF EXISTS "staff_insert_prebuilds" ON prebuilds;
DROP POLICY IF EXISTS "staff_update_prebuilds" ON prebuilds;
DROP POLICY IF EXISTS "staff_delete_prebuilds" ON prebuilds;
DROP POLICY IF EXISTS "staff_select_prebuild_components" ON prebuild_components;
DROP POLICY IF EXISTS "staff_insert_prebuild_components" ON prebuild_components;
DROP POLICY IF EXISTS "staff_update_prebuild_components" ON prebuild_components;
DROP POLICY IF EXISTS "staff_delete_prebuild_components" ON prebuild_components;

CREATE POLICY "staff_select_prebuilds" ON prebuilds FOR SELECT
  TO authenticated
  USING (
    status = 'published'
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()::text
        AND profiles.role IN ('sales','workshop','content','support','admin')
    )
  );

CREATE POLICY "staff_insert_prebuilds" ON prebuilds FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()::text
        AND profiles.role IN ('sales','workshop','content','support','admin')
    )
  );

CREATE POLICY "staff_update_prebuilds" ON prebuilds FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()::text
        AND profiles.role IN ('sales','workshop','content','support','admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()::text
        AND profiles.role IN ('sales','workshop','content','support','admin')
    )
  );

CREATE POLICY "staff_delete_prebuilds" ON prebuilds FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()::text
        AND profiles.role = 'admin'
    )
  );

CREATE POLICY "staff_write_prebuild_components" ON prebuild_components FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()::text
        AND profiles.role IN ('sales','workshop','content','support','admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()::text
        AND profiles.role IN ('sales','workshop','content','support','admin')
    )
  );

-- ---------------------------------------------------------------------------
-- Guest checkout: require a real-looking email / name, bounded cart
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "guest_insert_contacts" ON crm_contacts;
CREATE POLICY "guest_insert_contacts" ON crm_contacts FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    char_length(trim(display_name)) BETWEEN 1 AND 120
    AND email IS NOT NULL
    AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    AND char_length(email) <= 254
    AND coalesce(crm_source, 'website') IN ('website','guest_checkout','studio')
  );

DROP POLICY IF EXISTS "staff_insert_contacts" ON crm_contacts;
CREATE POLICY "staff_insert_contacts" ON crm_contacts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()::text
        AND profiles.role IN ('sales','workshop','content','support','admin')
    )
  );

DROP POLICY IF EXISTS "guest_insert_orders" ON shop_orders;
DROP POLICY IF EXISTS "anon_insert_orders" ON shop_orders;
DROP POLICY IF EXISTS "auth_insert_orders" ON shop_orders;

CREATE POLICY "guest_insert_orders" ON shop_orders FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    id LIKE 'ESO-%'
    AND char_length(id) BETWEEN 8 AND 40
    AND jsonb_typeof(lines) = 'array'
    AND jsonb_array_length(lines) BETWEEN 1 AND 40
    AND char_length(coalesce(shipping_name, '')) BETWEEN 1 AND 120
    AND coalesce(status, 'pending') = 'pending'
  );

DROP POLICY IF EXISTS "staff_insert_orders" ON shop_orders;
CREATE POLICY "staff_insert_orders" ON shop_orders FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()::text
        AND profiles.role IN ('sales','workshop','content','support','admin')
    )
  );

-- ---------------------------------------------------------------------------
-- Order lookup (guest): email + order id, no table-wide SELECT
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lookup_guest_order(p_id text, p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  em text := lower(trim(coalesce(p_email, '')));
  oid text := trim(coalesce(p_id, ''));
BEGIN
  IF oid = '' OR em NOT LIKE '%@%.%' THEN
    RETURN NULL;
  END IF;

  SELECT
    o.id,
    o.status,
    o.lines,
    o.total_ex_gst,
    o.total_inc_gst,
    o.tracking_number,
    o.carrier,
    o.invoice_number,
    o.created_at,
    o.shipping_name,
    o.postcode
  INTO rec
  FROM shop_orders o
  LEFT JOIN crm_contacts c ON c.id = o.contact_id
  LEFT JOIN profiles p ON p.user_id = o.user_id
  WHERE o.id = oid
    AND (
      lower(coalesce(c.email, '')) = em
      OR lower(coalesce(p.email, '')) = em
    )
  LIMIT 1;

  IF rec.id IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', rec.id,
    'status', rec.status,
    'lines', rec.lines,
    'total_ex_gst', rec.total_ex_gst,
    'total_inc_gst', rec.total_inc_gst,
    'tracking_number', rec.tracking_number,
    'carrier', rec.carrier,
    'invoice_number', rec.invoice_number,
    'created_at', rec.created_at,
    'shipping_name', rec.shipping_name,
    'postcode', rec.postcode
  );
END;
$$;

REVOKE ALL ON FUNCTION public.lookup_guest_order(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_guest_order(text, text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Staff alerts (filled by trigger so guest checkout can notify without write rights)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'order',
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  href text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE staff_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_select_alerts" ON staff_alerts;
CREATE POLICY "staff_select_alerts" ON staff_alerts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()::text
        AND profiles.role IN ('sales','workshop','content','support','admin')
    )
  );

DROP POLICY IF EXISTS "staff_update_alerts" ON staff_alerts;
CREATE POLICY "staff_update_alerts" ON staff_alerts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()::text
        AND profiles.role IN ('sales','workshop','content','support','admin')
    )
  );

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
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shop_orders_alert ON shop_orders;
CREATE TRIGGER shop_orders_alert
  AFTER INSERT ON shop_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.on_shop_order_insert();

-- ---------------------------------------------------------------------------
-- Jobs link to OMS orders
-- ---------------------------------------------------------------------------
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS order_id text;

-- ---------------------------------------------------------------------------
-- Service tickets
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_tickets (
  id text PRIMARY KEY,
  user_id text,
  contact_id uuid,
  order_id text,
  subject text NOT NULL,
  body text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_replies (
  id serial PRIMARY KEY,
  ticket_id text NOT NULL REFERENCES service_tickets(id) ON DELETE CASCADE,
  actor_id text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS service_tickets_user_idx ON service_tickets (user_id);
CREATE INDEX IF NOT EXISTS service_replies_ticket_idx ON service_replies (ticket_id);

ALTER TABLE service_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_select_tickets" ON service_tickets;
CREATE POLICY "own_select_tickets" ON service_tickets FOR SELECT
  TO authenticated
  USING (
    auth.uid()::text = user_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()::text
        AND profiles.role IN ('sales','workshop','content','support','admin')
    )
  );

DROP POLICY IF EXISTS "own_insert_tickets" ON service_tickets;
CREATE POLICY "own_insert_tickets" ON service_tickets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "own_update_tickets" ON service_tickets;
CREATE POLICY "own_update_tickets" ON service_tickets FOR UPDATE
  TO authenticated
  USING (
    auth.uid()::text = user_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()::text
        AND profiles.role IN ('sales','workshop','content','support','admin')
    )
  );

DROP POLICY IF EXISTS "select_ticket_replies" ON service_replies;
CREATE POLICY "select_ticket_replies" ON service_replies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM service_tickets t
      WHERE t.id = ticket_id
        AND (
          t.user_id = auth.uid()::text
          OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()::text
              AND profiles.role IN ('sales','workshop','content','support','admin')
          )
        )
    )
  );

DROP POLICY IF EXISTS "insert_ticket_replies" ON service_replies;
CREATE POLICY "insert_ticket_replies" ON service_replies FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM service_tickets t
      WHERE t.id = ticket_id
        AND (
          t.user_id = auth.uid()::text
          OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()::text
              AND profiles.role IN ('sales','workshop','content','support','admin')
          )
        )
    )
  );

-- ---------------------------------------------------------------------------
-- Seed the three classic packages as published prebuilds if the table is empty
-- ---------------------------------------------------------------------------
INSERT INTO prebuilds (slug, name, kicker, blurb, description, image, price_ex_gst, highlights, featured, sort_order, status)
SELECT * FROM (
  VALUES
    (
      'starter',
      'Starter Rig',
      'Entry',
      'A solid, reliable first serious setup for beginners and casual racers.',
      'Gold Coast assembled TR120S V2 with Simagic Alpha EVO 12Nm, P1000 pedals and triple 32" screens. Compatibility checked before deposit.',
      '/rigs/starter.jpg',
      1126000,
      '["Trak Racer TR120S V2","Simagic Alpha EVO 12Nm","Triple 32\" curved","Race-optimised PC"]'::jsonb,
      true,
      0,
      'published'
    ),
    (
      'haptic',
      'Haptic Racing Simulator',
      'Most popular',
      'Balanced immersive build for every level — hydraulic brake, haptics, four screens.',
      'Exodus XR1 chassis with Simagic Alpha 15Nm, hydraulic P1000 and haptics. The most popular Gold Coast crate.',
      '/rigs/haptic.jpg',
      1899900,
      '["Exodus XR1","Simagic Alpha 15Nm","P1000 hydraulic + haptics","iRacing 12 months"]'::jsonb,
      true,
      1,
      'published'
    ),
    (
      'motion',
      'Motion Racing Simulator',
      'Flagship',
      'Closest thing to track performance — SR2 motion on the Exodus XR1 system.',
      'SIMRIG SR2 3-DOF on the Exodus XR1 with quad screens. White-glove crate freight Australia-wide.',
      '/rigs/motion.jpg',
      2899900,
      '["SIMRIG SR2 3-DOF","Exodus XR1","Quad screens","White-glove crate freight"]'::jsonb,
      true,
      2,
      'published'
    )
) AS seed(slug, name, kicker, blurb, description, image, price_ex_gst, highlights, featured, sort_order, status)
WHERE NOT EXISTS (SELECT 1 FROM prebuilds LIMIT 1)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO prebuild_components (prebuild_id, sku, qty, sort_order)
SELECT p.id, c.sku, c.qty, c.sort_order
FROM prebuilds p
JOIN (
  VALUES
    ('starter', 'tr120s', 1, 0),
    ('starter', 'alpha-evo-12', 1, 1),
    ('starter', 'gt-neo', 1, 2),
    ('starter', 'p1000', 1, 3),
    ('starter', 'seq-shifter', 1, 4),
    ('starter', 'handbrake', 1, 5),
    ('starter', 'pc-race', 1, 6),
    ('starter', 'aoc-32', 3, 7),
    ('starter', 'logi-surround', 1, 8),
    ('starter', 'side-mount', 1, 9),
    ('haptic', 'xr1', 1, 0),
    ('haptic', 'quad-mount', 1, 1),
    ('haptic', 'touring-seat', 1, 2),
    ('haptic', 'alpha-15', 1, 3),
    ('haptic', 'gt-neo', 1, 4),
    ('haptic', 'p1000-haptic', 1, 5),
    ('haptic', 'seq-shifter', 1, 6),
    ('haptic', 'aoc-32', 3, 7),
    ('haptic', 'aux-27', 1, 8),
    ('haptic', 'logi-surround', 1, 9),
    ('haptic', 'pro-x', 1, 10),
    ('haptic', 'iracing-12', 1, 11),
    ('haptic', 'pc-race', 1, 12),
    ('motion', 'xr1', 1, 0),
    ('motion', 'quad-mount', 1, 1),
    ('motion', 'touring-seat', 1, 2),
    ('motion', 'alpha-15', 1, 3),
    ('motion', 'gt-neo', 1, 4),
    ('motion', 'p1000-haptic', 1, 5),
    ('motion', 'seq-shifter', 1, 6),
    ('motion', 'aoc-32', 3, 7),
    ('motion', 'aux-27', 1, 8),
    ('motion', 'logi-surround', 1, 9),
    ('motion', 'pro-x', 1, 10),
    ('motion', 'iracing-12', 1, 11),
    ('motion', 'pc-race', 1, 12),
    ('motion', 'sr2', 1, 13)
) AS c(slug, sku, qty, sort_order) ON c.slug = p.slug
WHERE NOT EXISTS (
  SELECT 1 FROM prebuild_components pc WHERE pc.prebuild_id = p.id
);
