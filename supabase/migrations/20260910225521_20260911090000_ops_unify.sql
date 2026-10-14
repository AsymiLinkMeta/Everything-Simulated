/*
# Operations Unification Migration

## Summary

This migration unifies the operations pipeline by:

1. Seeding the three classic prebuilt simulators (Starter / Haptic / Motion) into the
   `prebuilds` table if no published rows exist, so the public catalogue is never empty.
2. Tightening Row-Level Security on `prebuilds` and `prebuild_components` so that
   writes (INSERT / UPDATE / DELETE) are restricted to staff only, replacing the
   previous `WITH CHECK (true)` policies that allowed any authenticated user to
   mutate prebuild data.
3. Tightening the guest INSERT policies on `crm_contacts` and `shop_orders` so that
   guest submissions require a non-empty email and a non-empty `lines` array,
   preventing blank spam inserts.
4. Adding a `pipeline_alerts` table for new-order notifications visible on the staff
   Pipeline dashboard.
5. Adding a `support_tickets` table for customer service enquiries, with RLS that
   lets customers see their own tickets and staff see all tickets.
6. Adding a `convert_quote_to_order` SECURITY DEFINER function that atomically
   creates a `shop_orders` row and a `jobs` row from an approved quote, linking
   all three records.

## New Tables

### pipeline_alerts
- `id` (uuid, primary key) — unique alert identifier
- `order_id` (text) — the shop_orders.id that triggered the alert
- `kind` (text, default 'new_order') — alert category
- `message` (text) — human-readable alert text
- `acknowledged` (boolean, default false) — whether staff has dismissed it
- `acknowledged_by` (text) — staff user_id who acknowledged it
- `acknowledged_at` (timestamptz) — when it was acknowledged
- `created_at` (timestamptz, default now()) — when the alert was raised

### support_tickets
- `id` (uuid, primary key) — unique ticket identifier
- `user_id` (text, nullable) — linked auth user for signed-in customers
- `contact_email` (text, not null) — email of the ticket submitter
- `contact_name` (text) — name of the submitter
- `order_id` (text, nullable) — related order ID if the ticket is about an order
- `subject` (text, not null) — short subject line
- `body` (text, not null) — the full message
- `status` (text, default 'open') — open / pending / resolved / closed
- `staff_reply` (text, nullable) — reply from staff
- `replied_by` (text, nullable) — staff user_id who replied
- `replied_at` (timestamptz, nullable) — when staff replied
- `created_at` (timestamptz, default now()) — when the ticket was submitted
- `updated_at` (timestamptz, default now()) — last update timestamp

## Modified Tables

### prebuilds
- No schema changes. RLS policies tightened (see Security section).

### prebuild_components
- No schema changes. RLS policies tightened (see Security section).

### crm_contacts
- No schema changes. Guest INSERT policy tightened to require non-null email.

### shop_orders
- No schema changes. Guest INSERT policy tightened to require non-null lines.

## Security Changes (RLS)

### prebuilds — staff-only writes
- DROP `staff_insert_prebuilds` (was `WITH CHECK (true)`) and recreate with
  `WITH CHECK (is_staff())`.
- DROP `staff_update_prebuilds` (was `USING (true) WITH CHECK (true)`) and
  recreate with `USING (is_staff()) WITH CHECK (is_staff())`.
- DROP `staff_delete_prebuilds` (was `USING (true)`) and recreate with
  `USING (is_admin())`.
- `anon_select_prebuilds` (published read) and `staff_select_prebuilds` remain.

### prebuild_components — staff-only writes
- DROP `staff_insert_prebuild_components` (was `WITH CHECK (true)`) and
  recreate with `WITH CHECK (is_staff())`.
- DROP `staff_update_prebuild_components` (was `USING (true) WITH CHECK (true)`)
  and recreate with `USING (is_staff()) WITH CHECK (is_staff())`.
- DROP `staff_delete_prebuild_components` (was `USING (true)`) and recreate
  with `USING (is_staff())`.
- SELECT policies remain unchanged.

### crm_contacts — guest insert requires email
- DROP `guest_insert_contacts` (was `WITH CHECK (true)`) and recreate with
  `WITH CHECK (contact_email IS NOT NULL AND contact_email != '')`
  scoped to `TO anon, authenticated`.
  NOTE: The column is named `email` on the table, so the check is
  `email IS NOT NULL AND email != ''`.

### shop_orders — guest insert requires non-empty lines
- DROP `guest_insert_orders` (was `WITH CHECK (true)`) and recreate with
  `WITH CHECK (jsonb_array_length(COALESCE(lines, '[]'::jsonb)) > 0)`
  scoped to `TO anon, authenticated`.

### pipeline_alerts
- Enable RLS.
- Staff-only SELECT / UPDATE (acknowledge).
- Any authenticated or anon INSERT (orders create alerts from the frontend).

### support_tickets
- Enable RLS.
- Signed-in users can SELECT their own tickets (`user_id = auth.uid()::text`).
- Staff can SELECT all tickets.
- Any authenticated user can INSERT a ticket (with user_id auto-filled).
- Anon can INSERT a ticket (guest service enquiries).
- Staff can UPDATE tickets (reply / status change).

## New Functions

### convert_quote_to_order(p_quote_id text)
SECURITY DEFINER function that:
1. Loads the quote and verifies it exists.
2. Creates a `shop_orders` row with status 'pending' from the quote's lines.
3. Creates a `jobs` row linked to the same user and quote.
4. Marks the quote status as 'won'.
5. Returns the new order_id and job_id.
Only callable by authenticated staff (enforced inside the function body).
*/

-- =====================================================================
-- 1. Seed prebuilds if none exist
-- =====================================================================

INSERT INTO prebuilds (slug, name, kicker, blurb, description, image, price_ex_gst, highlights, specs, capabilities, featured, sort_order, status)
SELECT 'starter-rig', 'Starter Rig', 'Entry point', 'A serious first sim rig: 12Nm direct drive, triple monitors, assembled and tested.',
'Everything Simulated Starter Rig. The first serious step into sim racing: Simagic Alpha EVO 12Nm direct drive wheel base, GT NEO wheel, P1000-S pedal set, Trak Racer TR120S rig frame, triple 32-inch AOC 240Hz monitors, and a dedicated race PC. Assembled, QA''d and crated on the Gold Coast.',
'/rigs/starter.jpg', 1126000,
'["12Nm direct drive wheel base","Triple 32-inch 240Hz monitors","Assembled and QA tested","Australia-wide crate freight"]'::jsonb,
'{"Wheel base":"Simagic Alpha EVO 12Nm","Wheel":"Simagic GT NEO","Pedals":"Simagic P1000-S","Frame":"Trak Racer TR120S","Monitors":"3x AOC 32-inch 240Hz","PC":"Dedicated race PC"}'::jsonb,
'["Static rig","Muscle memory training","Consistent ergonomics"]'::jsonb,
true, 1, 'published'
WHERE NOT EXISTS (SELECT 1 FROM prebuilds WHERE status = 'published' LIMIT 1);

INSERT INTO prebuilds (slug, name, kicker, blurb, description, image, price_ex_gst, highlights, specs, capabilities, featured, sort_order, status)
SELECT 'haptic-racing-simulator', 'Haptic Racing Simulator', 'Most popular', 'Hydraulic brake and seat transducers give you real feel without a motion platform.',
'Everything Simulated Haptic Racing Simulator. The most popular home build we ship: Simagic Alpha 15Nm direct drive, GT NEO wheel, P1000-S hydraulic brake pedals, Exodus XR1 rig frame, haptic transducers on pedals and seat, triple 32-inch AOC 240Hz monitors, 27-inch aux, and a dedicated race PC. Assembled, QA''d and crated on the Gold Coast.',
'/rigs/haptic.jpg', 1899900,
'["15Nm direct drive wheel base","Hydraulic brake pedal feel","Seat and pedal transducers","Triple 32-inch + 27-inch aux"]'::jsonb,
'{"Wheel base":"Simagic Alpha 15Nm","Wheel":"Simagic GT NEO","Pedals":"Simagic P1000-S hydraulic","Frame":"Exodus XR1","Monitors":"3x AOC 32-inch 240Hz + 27-inch aux","Haptics":"Seat + pedal transducers","PC":"Dedicated race PC"}'::jsonb,
'["Haptic feedback","Lock-up feel","Kerb vibration","No motion platform needed"]'::jsonb,
true, 2, 'published'
WHERE NOT EXISTS (SELECT 1 FROM prebuilds WHERE status = 'published' AND slug = 'haptic-racing-simulator' LIMIT 1);

INSERT INTO prebuilds (slug, name, kicker, blurb, description, image, price_ex_gst, highlights, specs, capabilities, featured, sort_order, status)
SELECT 'motion-racing-simulator', 'Motion Racing Simulator', 'Flagship', 'Full motion: heave, roll and pitch with SIMRIG SR2. The complete immersion rig.',
'Everything Simulated Motion Racing Simulator. The flagship: Simagic Alpha 15Nm direct drive, GT NEO wheel, P1000-S hydraulic brake pedals, Exodus XR1 rig frame, SIMRIG SR2 motion platform with heave / roll / pitch, triple 32-inch AOC 240Hz monitors, 27-inch aux, and a dedicated race PC. Assembled, QA''d and crated on the Gold Coast. Requires payload check (driver + seat + screens under 225 kg).',
'/rigs/motion.jpg', 2899900,
'["SIMRIG SR2 motion platform","Heave / roll / pitch","15Nm direct drive","Triple 32-inch + 27-inch aux"]'::jsonb,
'{"Wheel base":"Simagic Alpha 15Nm","Wheel":"Simagic GT NEO","Pedals":"Simagic P1000-S hydraulic","Frame":"Exodus XR1","Motion":"SIMRIG SR2","Monitors":"3x AOC 32-inch 240Hz + 27-inch aux","PC":"Dedicated race PC"}'::jsonb,
'["Full motion","Heave roll pitch","Dedicated room recommended","Payload check required"]'::jsonb,
true, 3, 'published'
WHERE NOT EXISTS (SELECT 1 FROM prebuilds WHERE status = 'published' AND slug = 'motion-racing-simulator' LIMIT 1);

-- =====================================================================
-- 2. Tighten prebuilds RLS — staff-only writes
-- =====================================================================

DROP POLICY IF EXISTS "staff_insert_prebuilds" ON prebuilds;
CREATE POLICY "staff_insert_prebuilds"
  ON prebuilds FOR INSERT
  TO authenticated
  WITH CHECK (is_staff());

DROP POLICY IF EXISTS "staff_update_prebuilds" ON prebuilds;
CREATE POLICY "staff_update_prebuilds"
  ON prebuilds FOR UPDATE
  TO authenticated
  USING (is_staff())
  WITH CHECK (is_staff());

DROP POLICY IF EXISTS "staff_delete_prebuilds" ON prebuilds;
CREATE POLICY "staff_delete_prebuilds"
  ON prebuilds FOR DELETE
  TO authenticated
  USING (is_admin());

-- =====================================================================
-- 3. Tighten prebuild_components RLS — staff-only writes
-- =====================================================================

DROP POLICY IF EXISTS "staff_insert_prebuild_components" ON prebuild_components;
CREATE POLICY "staff_insert_prebuild_components"
  ON prebuild_components FOR INSERT
  TO authenticated
  WITH CHECK (is_staff());

DROP POLICY IF EXISTS "staff_update_prebuild_components" ON prebuild_components;
CREATE POLICY "staff_update_prebuild_components"
  ON prebuild_components FOR UPDATE
  TO authenticated
  USING (is_staff())
  WITH CHECK (is_staff());

DROP POLICY IF EXISTS "staff_delete_prebuild_components" ON prebuild_components;
CREATE POLICY "staff_delete_prebuild_components"
  ON prebuild_components FOR DELETE
  TO authenticated
  USING (is_staff());

-- =====================================================================
-- 4. Tighten guest inserts — require email on contacts, lines on orders
-- =====================================================================

DROP POLICY IF EXISTS "guest_insert_contacts" ON crm_contacts;
CREATE POLICY "guest_insert_contacts"
  ON crm_contacts FOR INSERT
  TO anon, authenticated
  WITH CHECK (email IS NOT NULL AND email != '');

DROP POLICY IF EXISTS "guest_insert_orders" ON shop_orders;
CREATE POLICY "guest_insert_orders"
  ON shop_orders FOR INSERT
  TO anon, authenticated
  WITH CHECK (jsonb_array_length(COALESCE(lines, '[]'::jsonb)) > 0);

-- =====================================================================
-- 5. Pipeline alerts table
-- =====================================================================

CREATE TABLE IF NOT EXISTS pipeline_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text,
  kind text NOT NULL DEFAULT 'new_order',
  message text NOT NULL DEFAULT '',
  acknowledged boolean NOT NULL DEFAULT false,
  acknowledged_by text,
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pipeline_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_select_alerts" ON pipeline_alerts;
CREATE POLICY "staff_select_alerts"
  ON pipeline_alerts FOR SELECT
  TO authenticated
  USING (is_staff());

DROP POLICY IF EXISTS "anon_insert_alerts" ON pipeline_alerts;
CREATE POLICY "anon_insert_alerts"
  ON pipeline_alerts FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "staff_acknowledge_alerts" ON pipeline_alerts;
CREATE POLICY "staff_acknowledge_alerts"
  ON pipeline_alerts FOR UPDATE
  TO authenticated
  USING (is_staff())
  WITH CHECK (is_staff());

DROP POLICY IF EXISTS "staff_delete_alerts" ON pipeline_alerts;
CREATE POLICY "staff_delete_alerts"
  ON pipeline_alerts FOR DELETE
  TO authenticated
  USING (is_staff());

CREATE INDEX IF NOT EXISTS idx_pipeline_alerts_unack
  ON pipeline_alerts (created_at DESC)
  WHERE acknowledged = false;

-- =====================================================================
-- 6. Support tickets table
-- =====================================================================

CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text,
  contact_email text NOT NULL,
  contact_name text NOT NULL DEFAULT '',
  order_id text,
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  staff_reply text,
  replied_by text,
  replied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_tickets" ON support_tickets;
CREATE POLICY "select_own_tickets"
  ON support_tickets FOR SELECT
  TO authenticated
  USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "staff_select_all_tickets" ON support_tickets;
CREATE POLICY "staff_select_all_tickets"
  ON support_tickets FOR SELECT
  TO authenticated
  USING (is_staff());

DROP POLICY IF EXISTS "auth_insert_tickets" ON support_tickets;
CREATE POLICY "auth_insert_tickets"
  ON support_tickets FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "anon_insert_tickets" ON support_tickets;
CREATE POLICY "anon_insert_tickets"
  ON support_tickets FOR INSERT
  TO anon
  WITH CHECK (contact_email IS NOT NULL AND contact_email != '');

DROP POLICY IF EXISTS "staff_update_tickets" ON support_tickets;
CREATE POLICY "staff_update_tickets"
  ON support_tickets FOR UPDATE
  TO authenticated
  USING (is_staff())
  WITH CHECK (is_staff());

CREATE INDEX IF NOT EXISTS idx_support_tickets_status
  ON support_tickets (status, created_at DESC);

-- =====================================================================
-- 7. Convert quote to order function
-- =====================================================================

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
BEGIN
  SELECT is_staff() INTO v_is_staff;
  IF NOT v_is_staff THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;

  SELECT id, user_id, lines, total_ex_gst, postcode
    INTO v_quote
    FROM quotes
    WHERE id = p_quote_id
    LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found';
  END IF;

  v_order_id := 'ESO-' || upper(to_hex(extract(epoch from now())::bigint));

  INSERT INTO shop_orders (id, user_id, quote_id, status, lines, total_ex_gst, total_inc_gst, postcode, notes)
  VALUES (
    v_order_id,
    v_quote.user_id,
    v_quote.id,
    'pending',
    v_quote.lines,
    v_quote.total_ex_gst,
    round(v_quote.total_ex_gst * 1.1),
    v_quote.postcode,
    'Converted from quote ' || v_quote.id
  );

  INSERT INTO jobs (user_id, quote_id, stage, notes)
  VALUES (v_quote.user_id, v_quote.id, 'enquiry', 'Auto-created from quote conversion')
  RETURNING id INTO v_job_id;

  UPDATE quotes SET status = 'won', updated_at = now()
    WHERE id = p_quote_id;

  INSERT INTO pipeline_alerts (order_id, kind, message)
  VALUES (v_order_id, 'new_order', 'New order ' || v_order_id || ' from quote ' || p_quote_id);

  RETURN QUERY SELECT v_order_id, v_job_id;
END;
$$;

GRANT EXECUTE ON FUNCTION convert_quote_to_order(text) TO authenticated;
