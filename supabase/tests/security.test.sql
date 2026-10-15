-- Database security checks. Run against a database with every migration applied:
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/security.test.sql
-- Everything runs in one transaction and is rolled back. Any failed check raises.

BEGIN;

-- Fixtures: three auth users. Only "owner" is on the admin allowlist AND verified.
INSERT INTO auth.users (id, email, email_confirmed_at) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'first@example.com', now()),
  ('00000000-0000-0000-0000-00000000000b', 'owner@example.com', now()),
  ('00000000-0000-0000-0000-00000000000c', 'unverified@example.com', NULL);
INSERT INTO public.admin_bootstrap_emails (email) VALUES ('owner@example.com'), ('unverified@example.com');

CREATE OR REPLACE FUNCTION pg_temp.as_user(p_uid text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_uid, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
END $$;

CREATE OR REPLACE FUNCTION pg_temp.check(p_ok boolean, p_msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT coalesce(p_ok, false) THEN RAISE EXCEPTION 'FAILED: %', p_msg; END IF;
  RAISE NOTICE 'ok - %', p_msg;
END $$;

-- 1. The very first sign-up on an empty database is NOT admin any more.
SELECT pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
SELECT pg_temp.check((public.bootstrap_profile('first@example.com', 'First') ->> 'role') = 'customer',
  'first sign-up on an empty project stays customer');

-- 2. Claiming an allowlisted email via the client-supplied argument does nothing.
SELECT pg_temp.check((public.bootstrap_profile('owner@example.com', 'Spoof') ->> 'role') = 'customer',
  'client-supplied p_email cannot trigger admin promotion');

-- 3. A customer cannot change their own role.
DO $$
BEGIN
  UPDATE public.profiles SET role = 'admin' WHERE user_id = '00000000-0000-0000-0000-00000000000a';
  RAISE EXCEPTION 'FAILED: customer self-promotion was allowed';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'FAILED:%' THEN RAISE; END IF;
  RAISE NOTICE 'ok - customer cannot self-promote (%)', SQLERRM;
END $$;

-- 4. Even with a forged session setting, an API role cannot change roles.
DO $$
BEGIN
  PERFORM set_config('es.allow_role_change', 'on', true);
  UPDATE public.profiles SET role = 'admin' WHERE user_id = '00000000-0000-0000-0000-00000000000a';
  RAISE EXCEPTION 'FAILED: role change bypass via session setting';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'FAILED:%' THEN RAISE; END IF;
  RAISE NOTICE 'ok - no client-settable bypass (%)', SQLERRM;
END $$;

-- 5. Customers cannot read the allowlist or call the operator function.
DO $$
BEGIN
  PERFORM 1 FROM public.admin_bootstrap_emails;
  RAISE EXCEPTION 'FAILED: authenticated can read admin_bootstrap_emails';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'ok - admin_bootstrap_emails is not readable by authenticated';
END $$;
DO $$
BEGIN
  PERFORM public.promote_admin('first@example.com');
  RAISE EXCEPTION 'FAILED: authenticated can call promote_admin';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'ok - promote_admin is not callable by authenticated';
END $$;
DO $$
BEGIN
  PERFORM 1 FROM public.stripe_events;
  RAISE NOTICE 'ok - stripe_events select is policy-filtered for authenticated';
END $$;
SELECT pg_temp.check((SELECT count(*) FROM public.stripe_events) = 0, 'customers see no stripe_events rows');
RESET ROLE;

-- 6. A verified allowlisted email is promoted on sign-in.
SELECT pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
SELECT pg_temp.check((public.bootstrap_profile('owner@example.com', 'Owner') ->> 'role') = 'admin',
  'verified allowlisted email becomes admin');
RESET ROLE;

-- 7. An allowlisted but unverified email is not.
SELECT pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
SELECT pg_temp.check((public.bootstrap_profile('unverified@example.com', 'U') ->> 'role') = 'customer',
  'unverified allowlisted email stays customer');
RESET ROLE;

-- 8. Operator promotion from the SQL editor works, and an existing profile is upgraded.
SELECT public.promote_admin('first@example.com');
SELECT pg_temp.check((SELECT role FROM public.profiles WHERE user_id = '00000000-0000-0000-0000-00000000000a') = 'admin',
  'promote_admin upgrades an existing profile');

-- 9. Email auto-confirm trigger is gone.
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'auto_confirm_email_on_signup'),
  'auto-confirm trigger removed');
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-00000000000d', 'new@example.com');
SELECT pg_temp.check((SELECT email_confirmed_at FROM auth.users WHERE id = '00000000-0000-0000-0000-00000000000d') IS NULL,
  'new sign-ups are not auto-confirmed');

-- 10. stripe_events enforces one row per event id (webhook idempotency).
INSERT INTO public.stripe_events (id, type) VALUES ('evt_test_1', 'checkout.session.completed');
DO $$
BEGIN
  INSERT INTO public.stripe_events (id, type) VALUES ('evt_test_1', 'checkout.session.completed');
  RAISE EXCEPTION 'FAILED: duplicate stripe event accepted';
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'ok - duplicate stripe event rejected (23505)';
END $$;

-- 11. Guest order lookup has the shape create-checkout-session needs.
SELECT pg_temp.check(
  (SELECT string_agg(a, ',') FROM unnest((SELECT proargnames FROM pg_proc WHERE proname = 'lookup_guest_order')) a)
    LIKE '%paid_cents%',
  'lookup_guest_order returns paid_cents');

-- 12. A client INSERT asking for role=admin is stored as customer (hotfix guard).
RESET ROLE;
INSERT INTO auth.users (id, email, email_confirmed_at) VALUES ('00000000-0000-0000-0000-00000000000e', 'self@example.com', now());
INSERT INTO public.agent_memory (kind, title, body) VALUES ('note', 'internal', 'staff only');
SELECT pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
INSERT INTO public.profiles (user_id, email, role) VALUES ('00000000-0000-0000-0000-00000000000e', 'self@example.com', 'admin');
SELECT pg_temp.check((SELECT role FROM public.profiles WHERE user_id = '00000000-0000-0000-0000-00000000000e') = 'customer',
  'client insert with role=admin is stored as customer');

-- 13. Customers cannot read agent memory (staff-only knowledge base).
SELECT pg_temp.check((SELECT count(*) FROM public.agent_memory) = 0,
  'customers cannot read agent_memory');

-- ---- Server pricing and order integrity (20261015130000_server_pricing) ----
RESET ROLE;
INSERT INTO public.catalog_products (sku, brand, name, category, sell_ex_gst, listing_status, stock_status)
VALUES ('sec-priced', 'Test', 'Priced part', 'accessory', 100000, 'published', 'stock'),
       ('sec-enquiry', 'Test', 'Enquiry part', 'accessory', 0, 'draft', 'indent');
UPDATE public.catalog_products SET enquiry_only = true, listing_status = 'published' WHERE sku = 'sec-enquiry';

CREATE OR REPLACE FUNCTION pg_temp.as_anon() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  EXECUTE 'SET LOCAL ROLE anon';
END $$;

-- 14. Publishing at $0 is refused unless the product is enquiry-only.
DO $$
BEGIN
  INSERT INTO public.catalog_products (sku, brand, name, category, sell_ex_gst, listing_status, stock_status)
  VALUES ('sec-zero', 'Test', 'Zero', 'accessory', 0, 'published', 'stock');
  RAISE EXCEPTION 'FAILED: a $0 product was published';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'FAILED:%' THEN RAISE; END IF;
  RAISE NOTICE 'ok - $0 publish refused (%)', SQLERRM;
END $$;

-- 15. Guests cannot insert orders directly.
SELECT pg_temp.as_anon();
DO $$
BEGIN
  INSERT INTO public.shop_orders (id, status, lines, total_ex_gst, total_inc_gst) VALUES ('ESO-SEC-1', 'pending', '[]', 1, 1);
  RAISE EXCEPTION 'FAILED: anon inserted an order directly';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'FAILED:%' THEN RAISE; END IF;
  RAISE NOTICE 'ok - anon direct order insert refused';
END $$;

-- 16. quote_cart prices from the database and blocks enquiry-only lines.
SELECT pg_temp.check((public.quote_cart('[{"sku":"sec-priced","qty":2}]', '4215', NULL, NULL) ->> 'items_ex_gst')::int = 200000,
  'quote_cart charges the DB price');
SELECT pg_temp.check((public.quote_cart('[{"sku":"sec-enquiry","qty":1}]', '4215', NULL, NULL) ->> 'ok')::boolean = false,
  'quote_cart blocks enquiry-only products');

-- 17. place_order ignores client-supplied prices.
DO $$
DECLARE r jsonb;
BEGIN
  r := public.place_order('{"lines":[{"sku":"sec-priced","qty":1,"sellExGst":1}],"total_inc_gst":1,"email":"sec-guest@example.com","name":"Sec Guest","phone":"0400000000","address":"1 Test St","postcode":"4215"}');
  PERFORM set_config('sec.order', r ->> 'id', true);
END $$;
RESET ROLE;
SELECT pg_temp.check((SELECT items_ex_gst = 100000 AND total_inc_gst > 100000 FROM public.shop_orders WHERE id = current_setting('sec.order')),
  'place_order charges DB prices, not client-sent ones');

-- 18. Staff cannot edit totals or payments with a plain UPDATE; notes are fine.
RESET ROLE;
INSERT INTO public.profiles (user_id, email, role) VALUES ('00000000-0000-0000-0000-00000000000b', 'owner@example.com', 'admin')
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
INSERT INTO public.shop_orders (id, status, lines, total_ex_gst, total_inc_gst, shipping_name)
VALUES ('ESO-SEC-2', 'pending', '[{"sku":"sec-priced","qty":1}]', 100000, 110000, 'Sec');
SELECT pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
DO $$
BEGIN
  UPDATE public.shop_orders SET total_inc_gst = 1, paid_cents = 110000 WHERE id = 'ESO-SEC-2';
  RAISE EXCEPTION 'FAILED: staff edited totals directly';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'FAILED:%' THEN RAISE; END IF;
  RAISE NOTICE 'ok - direct total/payment edit refused';
END $$;
UPDATE public.shop_orders SET notes = 'call first' WHERE id = 'ESO-SEC-2';

-- 19. Packing or shipping an unpaid order is refused.
DO $$
BEGIN
  PERFORM public.staff_set_order_status('ESO-SEC-2', 'packing');
  RAISE EXCEPTION 'FAILED: unpaid order was packed';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'FAILED:%' THEN RAISE; END IF;
  RAISE NOTICE 'ok - unpaid order cannot be packed';
END $$;
DO $$
BEGIN
  PERFORM public.staff_ship_order('ESO-SEC-2', NULL, NULL);
  RAISE EXCEPTION 'FAILED: unpaid order was shipped';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'FAILED:%' THEN RAISE; END IF;
  RAISE NOTICE 'ok - unpaid order cannot be shipped';
END $$;

-- 20. Recording payment issues one sequential invoice number, kept on later payments.
SELECT public.staff_record_payment('ESO-SEC-2', 33000, 'bank');
SELECT pg_temp.check((SELECT invoice_number ~ '^ESI-[0-9]{6}$' AND status = 'paid' FROM public.shop_orders WHERE id = 'ESO-SEC-2'),
  'first payment issues an ESI- invoice number and marks paid');
CREATE TEMP TABLE IF NOT EXISTS _inv AS SELECT invoice_number FROM public.shop_orders WHERE id = 'ESO-SEC-2';
SELECT public.staff_record_payment('ESO-SEC-2', 10000, 'bank');
SELECT pg_temp.check((SELECT o.invoice_number = i.invoice_number FROM public.shop_orders o, _inv i WHERE o.id = 'ESO-SEC-2'),
  'second payment keeps the invoice number');

-- 21. A customer cannot call staff order RPCs ("e" is still a customer; "a" was promoted above).
SELECT pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
DO $$
BEGIN
  PERFORM public.staff_record_payment('ESO-SEC-2', 100, 'x');
  RAISE EXCEPTION 'FAILED: customer recorded a payment';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'FAILED:%' THEN RAISE; END IF;
  RAISE NOTICE 'ok - customers cannot record payments';
END $$;

ROLLBACK;
