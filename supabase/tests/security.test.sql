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

-- ---- Ambassador programme (20261016090000_ambassador_program) ----
RESET ROLE;
INSERT INTO public.ambassadors (id, slug, name, code, published, age_band, user_id)
VALUES ('00000000-0000-0000-0000-0000000000a1', 'sec-amb', 'Sec Ambassador', 'secamb', true, '18+', '00000000-0000-0000-0000-00000000000e');
SELECT pg_temp.check((SELECT code FROM public.ambassadors WHERE slug = 'sec-amb') = 'SECAMB', 'ambassador codes are stored upper-case');
SELECT pg_temp.check((SELECT default_commission_rate IS NULL FROM (SELECT public.ambassador_setting('default_commission_rate') #>> '{}' AS default_commission_rate) s),
  'default commission rate is seeded as NULL (not set)');

-- 22. Anon: clicks recorded through the RPC only, deduped per day, no raw identifiers or tables readable.
SELECT pg_temp.as_anon();
SELECT pg_temp.check((public.record_referral_click('secamb', 'visitor-abcdefghij-1', '/ambassadors/sec-amb?email=x@y.z', 'https://ig.example/p/1?u=2') ->> 'ok')::boolean,
  'anon can record a referral click for a published code');
SELECT public.record_referral_click('SECAMB', 'visitor-abcdefghij-1', '/', NULL);
SELECT pg_temp.check((public.record_referral_click('NOPE-NOPE', 'visitor-abcdefghij-1', '/', NULL) ->> 'ok')::boolean = false,
  'unknown codes are not recorded');
DO $$
BEGIN
  PERFORM 1 FROM public.referral_clicks;
  RAISE EXCEPTION 'FAILED: anon read referral_clicks';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok - anon cannot read referral_clicks';
END $$;
DO $$
BEGIN
  INSERT INTO public.referral_clicks (ambassador_id, visitor_hash) VALUES ('00000000-0000-0000-0000-0000000000a1', 'x');
  RAISE EXCEPTION 'FAILED: anon inserted a click directly';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok - anon cannot insert clicks directly';
END $$;
DO $$
BEGIN
  PERFORM 1 FROM public.ambassador_settings;
  RAISE EXCEPTION 'FAILED: anon read ambassador_settings';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok - anon cannot read ambassador_settings';
END $$;
DO $$
BEGIN
  PERFORM user_id FROM public.ambassadors;
  RAISE EXCEPTION 'FAILED: anon read ambassadors.user_id';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok - anon cannot read ambassadors.user_id';
END $$;
DO $$
BEGIN
  PERFORM 1 FROM public.ambassador_guardians;
  RAISE EXCEPTION 'FAILED: anon read guardians';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok - anon cannot read ambassador_guardians';
END $$;

-- 23. A referred guest order is attributed; no commission until money arrives.
DO $$
DECLARE r jsonb;
BEGIN
  r := public.place_order('{"lines":[{"sku":"sec-priced","qty":1}],"email":"sec-ref@example.com","name":"Ref Guest","phone":"0400000000","address":"1 Test St","postcode":"4215","referral_code":"secamb"}');
  PERFORM set_config('sec.ref_order', r ->> 'id', true);
END $$;
RESET ROLE;
SELECT pg_temp.check((SELECT count(*) = 1 AND min(landing_path) = '/ambassadors/sec-amb' AND min(referrer_host) = 'ig.example' FROM public.referral_clicks
                      WHERE ambassador_id = '00000000-0000-0000-0000-0000000000a1'),
  'one click per visitor per day, path without query, referrer host only');
SELECT pg_temp.check((SELECT referral_ambassador_id = '00000000-0000-0000-0000-0000000000a1' AND referral_source = 'checkout'
                      FROM public.shop_orders WHERE id = current_setting('sec.ref_order')),
  'checkout order is attributed to the ambassador');
SELECT pg_temp.check((SELECT count(*) = 0 FROM public.ambassador_commissions WHERE order_id = current_setting('sec.ref_order')),
  'no commission before the deposit');

-- 24. Ambassador (customer "e") cannot change rates, settings, payouts or their own code/publish state.
SELECT pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
DO $$
BEGIN
  PERFORM public.staff_set_ambassador_setting('default_commission_rate', '0.5');
  RAISE EXCEPTION 'FAILED: ambassador changed the default rate';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'FAILED:%' THEN RAISE; END IF;
  RAISE NOTICE 'ok - non-staff cannot change programme settings';
END $$;
DO $$
BEGIN
  PERFORM public.staff_set_ambassador_rate('00000000-0000-0000-0000-0000000000a1', 0.5);
  RAISE EXCEPTION 'FAILED: ambassador set their own rate';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'FAILED:%' THEN RAISE; END IF;
  RAISE NOTICE 'ok - non-staff cannot set rates';
END $$;
DO $$
BEGIN
  UPDATE public.ambassadors SET code = 'FREE-MONEY' WHERE id = '00000000-0000-0000-0000-0000000000a1';
  IF (SELECT code FROM public.ambassadors WHERE id = '00000000-0000-0000-0000-0000000000a1') = 'FREE-MONEY' THEN
    RAISE EXCEPTION 'FAILED: ambassador changed their own code';
  END IF;
  RAISE NOTICE 'ok - ambassador cannot change their code';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'FAILED:%' THEN RAISE; END IF;
  RAISE NOTICE 'ok - ambassador cannot change their code (%)', SQLERRM;
END $$;
SELECT pg_temp.check((SELECT count(*) = 0 FROM public.ambassador_commissions), 'ambassadors cannot read commission rows directly');
SELECT pg_temp.check((public.ambassador_dashboard() ->> 'clicks')::int = 1, 'ambassador dashboard shows their own clicks');
DO $$
BEGIN
  PERFORM public.ambassador_dashboard('00000000-0000-0000-0000-0000000000a1'::uuid, 30) FROM public.ambassadors WHERE false;
  PERFORM public.staff_commission_report();
  RAISE EXCEPTION 'FAILED: non-staff ran the commission report';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'FAILED:%' THEN RAISE; END IF;
  RAISE NOTICE 'ok - non-staff cannot run the commission report';
END $$;

-- 25. Commission lifecycle: pending (uncalculated) -> rate set -> approved -> paid.
SELECT pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
SELECT public.staff_record_payment(current_setting('sec.ref_order'), 30000, 'deposit');
SELECT pg_temp.check((SELECT status = 'pending' AND amount_cents IS NULL AND basis_ex_gst = 100000 FROM public.ambassador_commissions
                      WHERE order_id = current_setting('sec.ref_order')),
  'deposit creates a pending commission with no amount while the rate is unset');
SELECT public.staff_set_ambassador_setting('default_commission_rate', '0.05');
SELECT pg_temp.check((SELECT amount_cents = 5000 FROM public.ambassador_commissions WHERE order_id = current_setting('sec.ref_order')),
  'setting the default rate recalculates open commissions (5% of $1000 ex GST)');
DO $$
BEGIN
  PERFORM public.staff_mark_payout('00000000-0000-0000-0000-0000000000a1',
    array(SELECT id FROM public.ambassador_commissions WHERE order_id = current_setting('sec.ref_order')), 'EFT');
  RAISE EXCEPTION 'FAILED: pending commission was paid out';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'FAILED:%' THEN RAISE; END IF;
  RAISE NOTICE 'ok - pending commissions cannot be paid out';
END $$;
SELECT public.staff_record_payment(current_setting('sec.ref_order'),
  (SELECT total_inc_gst - paid_cents FROM public.shop_orders WHERE id = current_setting('sec.ref_order')), 'balance');
SELECT pg_temp.check((SELECT status = 'approved' FROM public.ambassador_commissions WHERE order_id = current_setting('sec.ref_order')),
  'fully paid order approves the commission');
SELECT public.staff_mark_payout('00000000-0000-0000-0000-0000000000a1',
  array(SELECT id FROM public.ambassador_commissions WHERE order_id = current_setting('sec.ref_order')), 'EFT 1');
SELECT pg_temp.check((SELECT status = 'paid' AND payout_id IS NOT NULL FROM public.ambassador_commissions WHERE order_id = current_setting('sec.ref_order')),
  'payout marks the commission paid');

-- 26. Self-referral is voided.
RESET ROLE;
INSERT INTO public.shop_orders (id, status, lines, total_ex_gst, total_inc_gst, shipping_name, user_id, referral_code)
VALUES ('ESO-SEC-SELF', 'pending', '[{"sku":"sec-priced","qty":1}]', 100000, 110000, 'Self', '00000000-0000-0000-0000-00000000000e', 'SECAMB');
SELECT pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
SELECT public.staff_record_payment('ESO-SEC-SELF', 30000, 'deposit');
SELECT pg_temp.check((SELECT status = 'void' FROM public.ambassador_commissions WHERE order_id = 'ESO-SEC-SELF'),
  'self-referred orders earn no commission');

-- 27. Minors: unpublished until a guardian approves; cannot opt themselves out; payouts held.
UPDATE public.ambassadors SET age_band = '16-17' WHERE id = '00000000-0000-0000-0000-0000000000a1';
SELECT pg_temp.check((SELECT NOT published FROM public.ambassadors WHERE id = '00000000-0000-0000-0000-0000000000a1'),
  'marking a published profile as under-18 unpublishes it');
DO $$
BEGIN
  UPDATE public.ambassadors SET published = true WHERE id = '00000000-0000-0000-0000-0000000000a1';
  RAISE EXCEPTION 'FAILED: minor published without guardian approval';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'FAILED:%' THEN RAISE; END IF;
  RAISE NOTICE 'ok - minor cannot be published without guardian approval';
END $$;
SELECT pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
DO $$
BEGIN
  PERFORM public.ambassador_self_update(p_age_band => '18+');
  RAISE EXCEPTION 'FAILED: minor changed their age band to adult';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'FAILED:%' THEN RAISE; END IF;
  RAISE NOTICE 'ok - a minor cannot switch themselves to adult';
END $$;
SELECT pg_temp.check((public.ambassador_set_guardian('00000000-0000-0000-0000-0000000000a1', 'Pat Parent', 'pat@example.com') ->> 'status') = 'pending',
  'ambassador can name their guardian');
DO $$
BEGIN
  PERFORM public.staff_guardian_signoff('00000000-0000-0000-0000-0000000000a1', 'self approved');
  RAISE EXCEPTION 'FAILED: ambassador signed off their own guardian approval';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'FAILED:%' THEN RAISE; END IF;
  RAISE NOTICE 'ok - only staff can sign off guardian approval';
END $$;

-- 28. Email method: token is service-role only, single use, and approves.
SELECT pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
SELECT public.staff_set_ambassador_setting('guardian_method', '"email"');
DO $$
BEGIN
  PERFORM public.create_guardian_token('00000000-0000-0000-0000-0000000000a1');
  RAISE EXCEPTION 'FAILED: staff session minted a guardian token';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok - guardian tokens are minted by the service role only';
END $$;
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT set_config('sec.gtoken', public.create_guardian_token('00000000-0000-0000-0000-0000000000a1') ->> 'token', true);
RESET ROLE;
SELECT pg_temp.check((SELECT token_hash IS NOT NULL AND token_hash <> current_setting('sec.gtoken') FROM public.ambassador_guardians
                      WHERE ambassador_id = '00000000-0000-0000-0000-0000000000a1'),
  'only a hash of the guardian token is stored');
SELECT pg_temp.as_anon();
SELECT pg_temp.check(public.guardian_link_info('not-a-real-token-000000000000') IS NULL, 'unknown guardian tokens reveal nothing');
SELECT pg_temp.check((public.guardian_link_info(current_setting('sec.gtoken')) ->> 'guardian_name') = 'Pat Parent', 'guardian link shows who it is for');
SELECT pg_temp.check((public.confirm_guardian_consent(current_setting('sec.gtoken'), true) ->> 'approved')::boolean, 'guardian can approve by link');
DO $$
BEGIN
  PERFORM public.confirm_guardian_consent(current_setting('sec.gtoken'), false);
  RAISE EXCEPTION 'FAILED: guardian token reused';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'FAILED:%' THEN RAISE; END IF;
  RAISE NOTICE 'ok - guardian tokens are single use';
END $$;
RESET ROLE;
SELECT pg_temp.check((SELECT status = 'approved' AND method = 'email' FROM public.ambassador_guardians WHERE ambassador_id = '00000000-0000-0000-0000-0000000000a1'),
  'guardian approval recorded with the email method');
SELECT pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
UPDATE public.ambassadors SET published = true WHERE id = '00000000-0000-0000-0000-0000000000a1';
SELECT pg_temp.check((SELECT published FROM public.ambassadors WHERE id = '00000000-0000-0000-0000-0000000000a1'),
  'minor can be published once the guardian has approved');
RESET ROLE;

-- ---- Cost price is not readable by API clients (20261017100000_hide_catalog_cost) ----
RESET ROLE;
UPDATE public.catalog_products SET cost_ex_gst = 61000 WHERE sku = 'sec-priced';
SELECT pg_temp.as_anon();
DO $$
BEGIN
  PERFORM cost_ex_gst FROM public.catalog_products;
  RAISE EXCEPTION 'FAILED: anon read cost_ex_gst';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok - anon cannot read catalog cost prices';
END $$;
DO $$
BEGIN
  PERFORM * FROM public.catalog_products;
  RAISE EXCEPTION 'FAILED: anon select * includes cost_ex_gst';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok - select * on catalog_products is refused for anon';
END $$;
SELECT pg_temp.check((SELECT sell_ex_gst = 100000 FROM public.catalog_products WHERE sku = 'sec-priced'),
  'anon still reads public catalogue columns');
DO $$
BEGIN
  PERFORM public.staff_catalog_costs();
  RAISE EXCEPTION 'FAILED: anon called staff_catalog_costs';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok - anon cannot call staff_catalog_costs';
END $$;
SELECT pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
DO $$
BEGIN
  PERFORM cost_ex_gst FROM public.catalog_products;
  RAISE EXCEPTION 'FAILED: customer read cost_ex_gst';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok - signed-in customers cannot read catalog cost prices';
END $$;
DO $$
BEGIN
  PERFORM public.staff_catalog_costs();
  RAISE EXCEPTION 'FAILED: customer called staff_catalog_costs';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'FAILED:%' THEN RAISE; END IF;
  RAISE NOTICE 'ok - customers cannot call staff_catalog_costs';
END $$;
SELECT pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
SELECT pg_temp.check((SELECT cost_ex_gst = 61000 FROM public.staff_catalog_costs() WHERE sku = 'sec-priced'),
  'staff read cost prices through staff_catalog_costs()');
UPDATE public.catalog_products SET cost_ex_gst = 62000 WHERE sku = 'sec-priced';
RESET ROLE;
SELECT pg_temp.check((SELECT cost_ex_gst = 62000 FROM public.catalog_products WHERE sku = 'sec-priced'),
  'staff can still write cost prices');

ROLLBACK;
