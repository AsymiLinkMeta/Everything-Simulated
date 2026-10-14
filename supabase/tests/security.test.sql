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

ROLLBACK;
