/*
# Core schema for Everything Simulated

## Overview
Creates the complete database schema for the Everything Simulated sim-racing store.
Multi-user app with sign-in; owner-scoped RLS using auth.uid() on user tables.

## New Tables
- profiles: user role mapping (customer/sales/workshop/content/support/admin)
- quotes: saved build configurations
- jobs: workshop jobs linked to quotes
- bookings: demo/showroom booking requests
- chat_messages: AI build assistant conversation history
- product_overrides: staff price/stock overrides

## Security
RLS enabled on all tables. Owner-scoped CRUD via auth.uid()::text = user_id.
*/

-- profiles
CREATE TABLE IF NOT EXISTS profiles (
  user_id text PRIMARY KEY,
  email text,
  display_name text,
  role text NOT NULL DEFAULT 'customer',
  postcode text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS profiles_role_idx ON profiles (role);

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

-- quotes
CREATE TABLE IF NOT EXISTS quotes (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  title text NOT NULL DEFAULT 'Custom build',
  status text NOT NULL DEFAULT 'draft',
  lines jsonb NOT NULL DEFAULT '[]',
  check_ok boolean NOT NULL DEFAULT false,
  total_ex_gst integer NOT NULL DEFAULT 0,
  postcode text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS quotes_user_id_idx ON quotes (user_id);
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_quotes" ON quotes;
CREATE POLICY "select_own_quotes" ON quotes FOR SELECT
  TO authenticated USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "insert_own_quotes" ON quotes;
CREATE POLICY "insert_own_quotes" ON quotes FOR INSERT
  TO authenticated WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "update_own_quotes" ON quotes;
CREATE POLICY "update_own_quotes" ON quotes FOR UPDATE
  TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "delete_own_quotes" ON quotes;
CREATE POLICY "delete_own_quotes" ON quotes FOR DELETE
  TO authenticated USING (auth.uid()::text = user_id);

-- jobs
CREATE TABLE IF NOT EXISTS jobs (
  id serial PRIMARY KEY,
  user_id text NOT NULL,
  quote_id text,
  stage text NOT NULL DEFAULT 'enquiry',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS jobs_user_id_idx ON jobs (user_id);
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_jobs" ON jobs;
CREATE POLICY "select_own_jobs" ON jobs FOR SELECT
  TO authenticated USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "insert_own_jobs" ON jobs;
CREATE POLICY "insert_own_jobs" ON jobs FOR INSERT
  TO authenticated WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "update_own_jobs" ON jobs;
CREATE POLICY "update_own_jobs" ON jobs FOR UPDATE
  TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

-- bookings
CREATE TABLE IF NOT EXISTS bookings (
  id serial PRIMARY KEY,
  user_id text NOT NULL,
  kind text NOT NULL DEFAULT 'demo',
  slot text,
  status text NOT NULL DEFAULT 'requested',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bookings_user_id_idx ON bookings (user_id);
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_bookings" ON bookings;
CREATE POLICY "select_own_bookings" ON bookings FOR SELECT
  TO authenticated USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "insert_own_bookings" ON bookings;
CREATE POLICY "insert_own_bookings" ON bookings FOR INSERT
  TO authenticated WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "update_own_bookings" ON bookings;
CREATE POLICY "update_own_bookings" ON bookings FOR UPDATE
  TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

-- chat_messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id serial PRIMARY KEY,
  user_id text NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_messages_user_id_idx ON chat_messages (user_id);
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_chat" ON chat_messages;
CREATE POLICY "select_own_chat" ON chat_messages FOR SELECT
  TO authenticated USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "insert_own_chat" ON chat_messages;
CREATE POLICY "insert_own_chat" ON chat_messages FOR INSERT
  TO authenticated WITH CHECK (auth.uid()::text = user_id);

-- product_overrides
CREATE TABLE IF NOT EXISTS product_overrides (
  sku text PRIMARY KEY,
  sell_ex_gst integer,
  stock_status text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE product_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_overrides" ON product_overrides;
CREATE POLICY "read_overrides" ON product_overrides FOR SELECT
  TO authenticated USING (true);