/*
# CRM, Orders, and Guest Checkout tables

1. New Tables
   - `crm_contacts` — customer/lead directory
     - id (uuid PK), user_id (nullable, links to auth.users for logged-in customers),
       display_name, email, phone, postcode, address, crm_stage, crm_source,
       crm_owner_id, follow_up_at, tags (jsonb), notes, timestamps
   - `crm_notes` — activity log per contact
     - id (serial PK), contact_id (FK), actor_id, kind, body, created_at
   - `shop_orders` — orders placed by guests or logged-in users
     - id (text PK), contact_id (FK nullable), user_id (nullable),
       quote_id, status, lines (jsonb), totals, shipping fields,
       tracking, carrier, invoice, notes, return_reason, timestamps
   
2. Security
   - RLS enabled on all tables.
   - `crm_contacts`: staff full CRUD, anon/authenticated can INSERT (guest checkout creates a contact).
   - `crm_notes`: staff only.
   - `shop_orders`: staff full CRUD; anon+authenticated can INSERT (guest checkout);
     authenticated users can SELECT their own orders.

3. Notes
   - Guest checkout flow: anon user inserts a crm_contact then a shop_order.
   - Staff policies use a subquery on profiles.role.
*/

-- crm_contacts
CREATE TABLE IF NOT EXISTS crm_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text,
  display_name text NOT NULL DEFAULT '',
  email text,
  phone text,
  postcode text,
  address text,
  crm_stage text NOT NULL DEFAULT 'lead',
  crm_source text DEFAULT 'website',
  crm_owner_id text,
  follow_up_at date,
  tags jsonb NOT NULL DEFAULT '[]',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE crm_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_select_contacts" ON crm_contacts;
CREATE POLICY "staff_select_contacts" ON crm_contacts FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid()::text AND profiles.role IN ('sales','workshop','content','support','admin'))
  );

DROP POLICY IF EXISTS "staff_update_contacts" ON crm_contacts;
CREATE POLICY "staff_update_contacts" ON crm_contacts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid()::text AND profiles.role IN ('sales','workshop','content','support','admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid()::text AND profiles.role IN ('sales','workshop','content','support','admin'))
  );

DROP POLICY IF EXISTS "staff_delete_contacts" ON crm_contacts;
CREATE POLICY "staff_delete_contacts" ON crm_contacts FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid()::text AND profiles.role = 'admin')
  );

-- Allow anyone (guest or logged-in) to insert a contact during checkout
DROP POLICY IF EXISTS "guest_insert_contacts" ON crm_contacts;
CREATE POLICY "guest_insert_contacts" ON crm_contacts FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- crm_notes
CREATE TABLE IF NOT EXISTS crm_notes (
  id serial PRIMARY KEY,
  contact_id uuid NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  actor_id text NOT NULL,
  kind text NOT NULL DEFAULT 'note',
  body text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE crm_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_select_notes" ON crm_notes;
CREATE POLICY "staff_select_notes" ON crm_notes FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid()::text AND profiles.role IN ('sales','workshop','content','support','admin'))
  );

DROP POLICY IF EXISTS "staff_insert_notes" ON crm_notes;
CREATE POLICY "staff_insert_notes" ON crm_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid()::text AND profiles.role IN ('sales','workshop','content','support','admin'))
  );

DROP POLICY IF EXISTS "staff_update_notes" ON crm_notes;
CREATE POLICY "staff_update_notes" ON crm_notes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid()::text AND profiles.role IN ('sales','workshop','content','support','admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid()::text AND profiles.role IN ('sales','workshop','content','support','admin'))
  );

DROP POLICY IF EXISTS "staff_delete_notes" ON crm_notes;
CREATE POLICY "staff_delete_notes" ON crm_notes FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid()::text AND profiles.role IN ('sales','workshop','content','support','admin'))
  );

-- shop_orders
CREATE TABLE IF NOT EXISTS shop_orders (
  id text PRIMARY KEY,
  contact_id uuid REFERENCES crm_contacts(id),
  user_id text,
  quote_id text,
  status text NOT NULL DEFAULT 'pending',
  lines jsonb NOT NULL DEFAULT '[]',
  total_ex_gst integer NOT NULL DEFAULT 0,
  total_inc_gst integer NOT NULL DEFAULT 0,
  shipping_name text,
  shipping_address text,
  postcode text,
  tracking_number text,
  carrier text NOT NULL DEFAULT 'ES Crate Freight',
  invoice_number text,
  notes text NOT NULL DEFAULT '',
  return_reason text,
  packed_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE shop_orders ENABLE ROW LEVEL SECURITY;

-- Staff can do everything
DROP POLICY IF EXISTS "staff_select_orders" ON shop_orders;
CREATE POLICY "staff_select_orders" ON shop_orders FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()::text
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid()::text AND profiles.role IN ('sales','workshop','content','support','admin'))
  );

DROP POLICY IF EXISTS "staff_update_orders" ON shop_orders;
CREATE POLICY "staff_update_orders" ON shop_orders FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid()::text AND profiles.role IN ('sales','workshop','content','support','admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid()::text AND profiles.role IN ('sales','workshop','content','support','admin'))
  );

DROP POLICY IF EXISTS "staff_delete_orders" ON shop_orders;
CREATE POLICY "staff_delete_orders" ON shop_orders FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid()::text AND profiles.role = 'admin')
  );

-- Guest and logged-in users can place orders
DROP POLICY IF EXISTS "guest_insert_orders" ON shop_orders;
CREATE POLICY "guest_insert_orders" ON shop_orders FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Index for order lookups
CREATE INDEX IF NOT EXISTS idx_shop_orders_user_id ON shop_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_shop_orders_contact_id ON shop_orders(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_user_id ON crm_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_notes_contact_id ON crm_notes(contact_id);
