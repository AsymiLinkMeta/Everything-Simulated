/*
# Ambassador programme: attribution, click tracking, commissions, payouts, guardian approval

Everything here is data or settings in the database. Nothing about an ambassador is hardcoded
in the app.

1. Settings (`ambassador_settings`, staff only)
   - default_commission_rate: NULL until Patrick sets it. While it's NULL (and an ambassador
     has no rate of their own) commissions are recorded with no amount ("not calculated").
     Setting a rate fills in every open commission.
   - commission_basis: 'items' (goods ex GST, default) or 'items_and_freight'.
   - guardian_method: 'staff' (staff sign-off, default) or 'email' (confirmation link).
   - guardian_link_days: how long an emailed guardian link stays valid.
   - click_salt: random; mixed into visitor hashes so they can't be reversed or joined.
   `pricing_settings.referral_cookie_days` (public) = 90: the attribution cookie lifetime.
2. `ambassador_tiers` replaces the tier labels hardcoded in the app.
3. `ambassador_terms` (staff only): per-ambassador commission rate. Kept off `ambassadors`
   because published ambassador rows are publicly readable.
4. `ambassador_guardians` (staff only; the ambassador reads their own status via RPC):
   guardian contact and approval for under-18s. A minor's profile can't be published and
   their commissions can't be paid out until a guardian has approved.
5. Attribution: last touch. `referral_code` on quotes and tickets (leads) and orders;
   orders also get `referral_ambassador_id`, `referral_source` (checkout|quote) and
   `referral_at`. An order with no code inherits its quote's code.
   `validate_referral_code` now only checks a code when it changes, so unpublishing an
   ambassador later doesn't strip attribution from their existing orders.
6. `referral_clicks`: no IP, no user agent, no cookie value. One row per ambassador, day and
   visitor, where visitor_hash = sha256(random first-party id, ambassador, salt). Written
   only by `record_referral_click()`; readable by staff; ambassadors see counts via RPC.
7. `ambassador_commissions`: one per referred order, ex GST.
   pending (deposit received) -> approved (balance paid in full) -> paid (staff payout).
   void if the order is cancelled or fully refunded, or it's a self-referral.
   `ambassador_payouts` groups the commissions paid together.
8. RPCs: ambassador_dashboard, my_guardian_status, ambassador_set_guardian,
   staff_guardian_signoff, staff_guardian_decline, create_guardian_token (service role),
   confirm_guardian_consent (anon, by token), staff_mark_payout, staff_commission_report,
   staff_set_ambassador_rate, staff_set_ambassador_setting.
*/

------------------------------------------------------------------------------
-- 1. Settings
------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ambassador_settings (
  key text PRIMARY KEY,
  value jsonb,
  description text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.ambassador_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_read_ambassador_settings ON public.ambassador_settings;
CREATE POLICY staff_read_ambassador_settings ON public.ambassador_settings FOR SELECT TO authenticated
  USING (public.is_staff() AND key <> 'click_salt');
-- Writes go through staff_set_ambassador_setting() so values are validated.

INSERT INTO public.ambassador_settings (key, value, description) VALUES
  ('default_commission_rate', 'null', 'Fraction of the ex-GST basis, e.g. 0.05. NULL = not set: commissions are not calculated.'),
  ('commission_basis', '"items"', '"items" (goods ex GST) or "items_and_freight"'),
  ('guardian_method', '"staff"', '"staff" (staff sign-off) or "email" (confirmation link to the guardian)'),
  ('guardian_link_days', '14', 'Days an emailed guardian link stays valid'),
  ('click_salt', to_jsonb(encode(extensions.gen_random_bytes(24), 'hex')), 'Secret salt for visitor hashes')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.pricing_settings (key, value, description) VALUES
  ('referral_cookie_days', '90', 'Lifetime of the first-party ambassador attribution cookie (last touch)')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.ambassador_setting(p_key text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT value FROM public.ambassador_settings WHERE key = p_key
$$;
REVOKE ALL ON FUNCTION public.ambassador_setting(text) FROM public, anon, authenticated;

------------------------------------------------------------------------------
-- 2. Tiers (were TIER_LABELS in src/lib/es/ambassadors.ts)
------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ambassador_tiers (
  key text PRIMARY KEY,
  label text NOT NULL,
  description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0
);
ALTER TABLE public.ambassador_tiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS public_read_ambassador_tiers ON public.ambassador_tiers;
CREATE POLICY public_read_ambassador_tiers ON public.ambassador_tiers FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS admin_write_ambassador_tiers ON public.ambassador_tiers;
CREATE POLICY admin_write_ambassador_tiers ON public.ambassador_tiers FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
INSERT INTO public.ambassador_tiers (key, label, sort_order) VALUES
  ('fully_sponsored', 'Fully Sponsored Driver', 10),
  ('sponsored_driver', 'Brand Ambassador', 20),
  ('sponsored_customer', 'Sponsored Customer', 30)
ON CONFLICT (key) DO NOTHING;
INSERT INTO public.ambassador_tiers (key, label, sort_order)
  SELECT DISTINCT a.tier, initcap(replace(a.tier, '_', ' ')), 90 FROM public.ambassadors a
  WHERE NOT EXISTS (SELECT 1 FROM public.ambassador_tiers t WHERE t.key = a.tier);
ALTER TABLE public.ambassadors DROP CONSTRAINT IF EXISTS ambassadors_tier_fkey;
ALTER TABLE public.ambassadors ADD CONSTRAINT ambassadors_tier_fkey
  FOREIGN KEY (tier) REFERENCES public.ambassador_tiers(key) ON UPDATE CASCADE;

------------------------------------------------------------------------------
-- 3. Per-ambassador terms and 4. guardians
------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ambassador_terms (
  ambassador_id uuid PRIMARY KEY REFERENCES public.ambassadors(id) ON DELETE CASCADE,
  commission_rate numeric(6,4) CHECK (commission_rate IS NULL OR (commission_rate >= 0 AND commission_rate <= 0.5)),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.ambassador_terms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_read_ambassador_terms ON public.ambassador_terms;
CREATE POLICY staff_read_ambassador_terms ON public.ambassador_terms FOR SELECT TO authenticated USING (public.is_staff());

CREATE OR REPLACE FUNCTION public.ambassador_is_minor(p_age_band text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT coalesce(p_age_band IN ('U12', '12-15', '16-17'), false) $$;

CREATE TABLE IF NOT EXISTS public.ambassador_guardians (
  ambassador_id uuid PRIMARY KEY REFERENCES public.ambassadors(id) ON DELETE CASCADE,
  guardian_name text NOT NULL DEFAULT '',
  guardian_email text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('not_required', 'pending', 'approved', 'declined')),
  method text CHECK (method IN ('staff', 'email')),
  note text NOT NULL DEFAULT '',
  requested_at timestamptz,
  decided_at timestamptz,
  decided_by uuid,
  token_hash text,
  token_expires timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ambassador_guardians ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_read_ambassador_guardians ON public.ambassador_guardians;
CREATE POLICY staff_read_ambassador_guardians ON public.ambassador_guardians FOR SELECT TO authenticated USING (public.is_staff());

-- Keep a guardian row in step with the age band.
CREATE OR REPLACE FUNCTION public.sync_ambassador_guardian()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.ambassador_is_minor(NEW.age_band) THEN
    INSERT INTO ambassador_guardians (ambassador_id, status) VALUES (NEW.id, 'pending')
    ON CONFLICT (ambassador_id) DO UPDATE
      SET status = CASE WHEN ambassador_guardians.status = 'not_required' THEN 'pending' ELSE ambassador_guardians.status END,
          updated_at = now();
  ELSE
    UPDATE ambassador_guardians SET status = 'not_required', token_hash = NULL, token_expires = NULL, updated_at = now()
     WHERE ambassador_id = NEW.id AND status <> 'not_required';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS zz_sync_ambassador_guardian ON public.ambassadors;
CREATE TRIGGER zz_sync_ambassador_guardian AFTER INSERT OR UPDATE OF age_band ON public.ambassadors
  FOR EACH ROW EXECUTE FUNCTION public.sync_ambassador_guardian();
INSERT INTO public.ambassador_guardians (ambassador_id, status)
  SELECT id, 'pending' FROM public.ambassadors WHERE public.ambassador_is_minor(age_band)
ON CONFLICT DO NOTHING;

-- Row guard: ambassadors may edit their profile, not their code, tier, publishing or link.
-- Minors can't go live until a guardian has approved.
CREATE OR REPLACE FUNCTION public.guard_ambassador_row()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_guardian text;
BEGIN
  NEW.code := upper(btrim(NEW.code));
  IF NEW.code !~ '^[A-Z0-9-]{3,24}$' THEN
    RAISE EXCEPTION 'Ambassador codes are 3-24 letters, numbers or dashes' USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'UPDATE' AND current_user IN ('anon', 'authenticated') AND NOT public.is_staff() THEN
    IF NEW.code IS DISTINCT FROM OLD.code OR NEW.slug IS DISTINCT FROM OLD.slug
       OR NEW.published IS DISTINCT FROM OLD.published OR NEW.tier IS DISTINCT FROM OLD.tier
       OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.sort_order IS DISTINCT FROM OLD.sort_order THEN
      RAISE EXCEPTION 'Only staff can change the code, link, tier or publishing' USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  -- A minor can't opt out of guardian approval by changing their own age band.
  IF TG_OP = 'UPDATE' AND public.ambassador_is_minor(OLD.age_band) AND NOT public.ambassador_is_minor(NEW.age_band)
     AND auth.uid() IS NOT NULL AND NOT public.is_staff() THEN
    RAISE EXCEPTION 'Ask the workshop to update your age band' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW.published AND public.ambassador_is_minor(NEW.age_band) THEN
    SELECT status INTO v_guardian FROM ambassador_guardians WHERE ambassador_id = NEW.id;
    IF v_guardian IS DISTINCT FROM 'approved' THEN
      IF TG_OP = 'UPDATE' AND OLD.published AND NEW.age_band IS DISTINCT FROM OLD.age_band THEN
        NEW.published := false;  -- newly marked as a minor: take the profile down until a guardian approves
      ELSE
        RAISE EXCEPTION 'A guardian must approve % before this profile can be published', NEW.name
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_ambassador_row ON public.ambassadors;
CREATE TRIGGER guard_ambassador_row BEFORE INSERT OR UPDATE ON public.ambassadors
  FOR EACH ROW EXECUTE FUNCTION public.guard_ambassador_row();

-- Public (anon) reads only profile columns: not user_id or timestamps.
REVOKE SELECT ON public.ambassadors FROM anon;
GRANT SELECT (id, slug, name, photo, bio, motorsport, series, class_name, team_status, base, age_band,
              crate, code, social, published, sort_order, rig_note, rig_specs, tier, updated_at)
  ON public.ambassadors TO anon;

------------------------------------------------------------------------------
-- 5. Attribution columns
------------------------------------------------------------------------------
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS referral_code text;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS referral_code text;
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS referral_ambassador_id uuid REFERENCES public.ambassadors(id) ON DELETE SET NULL;
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS referral_source text;
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS referral_at timestamptz;
CREATE INDEX IF NOT EXISTS shop_orders_referral_amb_idx ON public.shop_orders (referral_ambassador_id) WHERE referral_ambassador_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS quotes_referral_idx ON public.quotes (referral_code) WHERE referral_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS tickets_referral_idx ON public.support_tickets (referral_code) WHERE referral_code IS NOT NULL;

-- Validate a code only when it is set or changed.
CREATE OR REPLACE FUNCTION public.validate_referral_code()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE matched text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.referral_code IS NOT DISTINCT FROM OLD.referral_code THEN RETURN NEW; END IF;
  IF NEW.referral_code IS NULL OR btrim(NEW.referral_code) = '' THEN
    NEW.referral_code := NULL;
    RETURN NEW;
  END IF;
  SELECT code INTO matched FROM ambassadors WHERE code = upper(btrim(NEW.referral_code)) AND published LIMIT 1;
  NEW.referral_code := matched;  -- unknown or unpublished codes are dropped, never block
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_validate_referral_code ON public.quotes;
CREATE TRIGGER trg_validate_referral_code BEFORE INSERT OR UPDATE OF referral_code ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.validate_referral_code();
DROP TRIGGER IF EXISTS trg_validate_referral_code ON public.support_tickets;
CREATE TRIGGER trg_validate_referral_code BEFORE INSERT OR UPDATE OF referral_code ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.validate_referral_code();

-- Orders: inherit the quote's code when checkout had none; derive the ambassador id
-- from the code (never trust a client-sent id).
CREATE OR REPLACE FUNCTION public.attribute_order_referral()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.referral_code IS NOT NULL THEN
      NEW.referral_source := 'checkout';
    ELSIF NEW.quote_id IS NOT NULL THEN
      SELECT q.referral_code INTO v_code FROM quotes q
        JOIN ambassadors a ON a.code = q.referral_code AND a.published
       WHERE q.id = NEW.quote_id;
      IF v_code IS NOT NULL THEN NEW.referral_code := v_code; NEW.referral_source := 'quote'; END IF;
    END IF;
  ELSIF NEW.referral_code IS NOT DISTINCT FROM OLD.referral_code THEN
    NEW.referral_ambassador_id := OLD.referral_ambassador_id;
    NEW.referral_source := OLD.referral_source;
    NEW.referral_at := OLD.referral_at;
    RETURN NEW;
  END IF;
  IF NEW.referral_code IS NULL THEN
    NEW.referral_ambassador_id := NULL; NEW.referral_source := NULL; NEW.referral_at := NULL;
  ELSE
    SELECT id INTO NEW.referral_ambassador_id FROM ambassadors WHERE code = NEW.referral_code;
    NEW.referral_source := coalesce(NEW.referral_source, 'staff');
    NEW.referral_at := now();
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS zz_attribute_order_referral ON public.shop_orders;
CREATE TRIGGER zz_attribute_order_referral BEFORE INSERT OR UPDATE ON public.shop_orders
  FOR EACH ROW EXECUTE FUNCTION public.attribute_order_referral();
UPDATE public.shop_orders o SET referral_ambassador_id = a.id, referral_source = coalesce(o.referral_source, 'checkout'),
       referral_at = coalesce(o.referral_at, o.created_at)
  FROM public.ambassadors a WHERE a.code = o.referral_code AND o.referral_ambassador_id IS NULL;

------------------------------------------------------------------------------
-- 6. Click tracking
------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.referral_clicks (
  id bigserial PRIMARY KEY,
  ambassador_id uuid NOT NULL REFERENCES public.ambassadors(id) ON DELETE CASCADE,
  day date NOT NULL DEFAULT current_date,
  visitor_hash text NOT NULL,
  landing_path text NOT NULL DEFAULT '/',
  referrer_host text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ambassador_id, day, visitor_hash)
);
ALTER TABLE public.referral_clicks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_read_referral_clicks ON public.referral_clicks;
CREATE POLICY staff_read_referral_clicks ON public.referral_clicks FOR SELECT TO authenticated USING (public.is_staff());
REVOKE INSERT, UPDATE, DELETE ON public.referral_clicks FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_referral_click(p_code text, p_visitor text, p_path text DEFAULT '/', p_referrer text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  a record;
  v_path text;
  v_host text;
  v_days int := coalesce((SELECT (value #>> '{}')::int FROM pricing_settings WHERE key = 'referral_cookie_days'), 90);
BEGIN
  SELECT id, code, slug INTO a FROM ambassadors WHERE code = upper(btrim(coalesce(p_code, ''))) AND published;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false); END IF;
  IF coalesce(p_visitor, '') ~ '^[A-Za-z0-9_-]{16,64}$'
     AND (SELECT count(*) FROM referral_clicks WHERE ambassador_id = a.id AND day = current_date) < 5000 THEN
    -- Path only (no query string or fragment); referrer host only.
    v_path := left(split_part(split_part(coalesce(p_path, '/'), '?', 1), '#', 1), 200);
    IF v_path !~ '^/' THEN v_path := '/'; END IF;
    v_host := nullif(left(lower(substring(coalesce(p_referrer, '') FROM '^[a-z]+://([^/:?#]+)')), 100), '');
    INSERT INTO referral_clicks (ambassador_id, visitor_hash, landing_path, referrer_host)
    VALUES (a.id,
            encode(extensions.digest(p_visitor || ':' || a.id::text || ':' || coalesce(ambassador_setting('click_salt') #>> '{}', ''), 'sha256'), 'hex'),
            v_path, v_host)
    ON CONFLICT (ambassador_id, day, visitor_hash) DO NOTHING;
  END IF;
  RETURN jsonb_build_object('ok', true, 'code', a.code, 'slug', a.slug, 'cookie_days', v_days);
END $$;
REVOKE ALL ON FUNCTION public.record_referral_click(text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.record_referral_click(text, text, text, text) TO anon, authenticated;

------------------------------------------------------------------------------
-- 7. Commissions and payouts
------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ambassador_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id uuid NOT NULL REFERENCES public.ambassadors(id) ON DELETE RESTRICT,
  total_cents integer NOT NULL CHECK (total_cents >= 0),
  commission_count integer NOT NULL,
  reference text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
ALTER TABLE public.ambassador_payouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_read_ambassador_payouts ON public.ambassador_payouts;
CREATE POLICY staff_read_ambassador_payouts ON public.ambassador_payouts FOR SELECT TO authenticated USING (public.is_staff());

CREATE TABLE IF NOT EXISTS public.ambassador_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id uuid NOT NULL REFERENCES public.ambassadors(id) ON DELETE RESTRICT,
  order_id text NOT NULL UNIQUE REFERENCES public.shop_orders(id) ON DELETE RESTRICT,
  basis_ex_gst integer NOT NULL DEFAULT 0,
  rate numeric(6,4),
  amount_cents integer,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'void')),
  void_reason text,
  payout_id uuid REFERENCES public.ambassador_payouts(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  paid_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ambassador_commissions_amb_idx ON public.ambassador_commissions (ambassador_id, status);
ALTER TABLE public.ambassador_commissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_read_ambassador_commissions ON public.ambassador_commissions;
CREATE POLICY staff_read_ambassador_commissions ON public.ambassador_commissions FOR SELECT TO authenticated USING (public.is_staff());

CREATE OR REPLACE FUNCTION public.ambassador_effective_rate(p_ambassador uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(
    (SELECT commission_rate FROM ambassador_terms WHERE ambassador_id = p_ambassador),
    (SELECT CASE WHEN jsonb_typeof(value) = 'number' THEN (value #>> '{}')::numeric END
       FROM ambassador_settings WHERE key = 'default_commission_rate'))
$$;
REVOKE ALL ON FUNCTION public.ambassador_effective_rate(uuid) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_order_commission(p_order text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o record; c record; a record;
  v_basis int; v_rate numeric; v_status text; v_reason text; v_net int;
  v_freight boolean := coalesce(ambassador_setting('commission_basis') #>> '{}', 'items') = 'items_and_freight';
BEGIN
  SELECT * INTO o FROM shop_orders WHERE id = p_order;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO c FROM ambassador_commissions WHERE order_id = p_order FOR UPDATE;
  IF c.status = 'paid' THEN RETURN; END IF;  -- paid out: clawbacks are handled by staff

  IF o.referral_ambassador_id IS NULL OR (c.id IS NOT NULL AND c.ambassador_id <> o.referral_ambassador_id) THEN
    IF c.id IS NOT NULL THEN
      UPDATE ambassador_commissions SET status = 'void', void_reason = 'referral changed', updated_at = now() WHERE id = c.id;
    END IF;
    IF o.referral_ambassador_id IS NULL THEN RETURN; END IF;
    DELETE FROM ambassador_commissions WHERE id = c.id AND status = 'void' AND payout_id IS NULL;
    c := NULL;
  END IF;

  IF c.id IS NULL AND coalesce(o.paid_cents, 0) <= 0 THEN RETURN; END IF;  -- starts at the deposit

  SELECT id, user_id INTO a FROM ambassadors WHERE id = o.referral_ambassador_id;
  v_net := greatest(o.total_inc_gst - coalesce(o.refunded_cents, 0), 0);
  v_basis := coalesce(o.items_ex_gst, o.total_ex_gst - coalesce(o.freight_ex_gst, 0), 0)
             + CASE WHEN v_freight THEN coalesce(o.freight_ex_gst, 0) ELSE 0 END;
  IF o.total_inc_gst > 0 AND coalesce(o.refunded_cents, 0) > 0 THEN
    v_basis := round(v_basis::numeric * v_net / o.total_inc_gst);
  END IF;
  v_rate := ambassador_effective_rate(a.id);

  IF o.status = 'cancelled' THEN v_status := 'void'; v_reason := 'order cancelled';
  ELSIF v_net = 0 THEN v_status := 'void'; v_reason := 'refunded';
  ELSIF a.user_id IS NOT NULL AND (o.user_id = a.user_id::text OR EXISTS (
          SELECT 1 FROM crm_contacts cc JOIN auth.users u ON lower(u.email) = lower(cc.email)
           WHERE cc.id = o.contact_id AND u.id = a.user_id)) THEN
    v_status := 'void'; v_reason := 'self-referral';
  ELSIF coalesce(o.paid_cents, 0) >= v_net THEN v_status := 'approved';
  ELSE v_status := 'pending';
  END IF;

  IF c.id IS NULL THEN
    INSERT INTO ambassador_commissions (ambassador_id, order_id, basis_ex_gst, rate, amount_cents, status, void_reason, approved_at)
    VALUES (a.id, o.id, v_basis, v_rate, CASE WHEN v_rate IS NULL THEN NULL ELSE round(v_basis * v_rate)::int END,
            v_status, v_reason, CASE WHEN v_status = 'approved' THEN now() END);
  ELSE
    UPDATE ambassador_commissions SET
      basis_ex_gst = v_basis, rate = v_rate,
      amount_cents = CASE WHEN v_rate IS NULL THEN NULL ELSE round(v_basis * v_rate)::int END,
      status = v_status, void_reason = v_reason,
      approved_at = CASE WHEN v_status = 'approved' THEN coalesce(approved_at, now()) ELSE NULL END,
      updated_at = now()
    WHERE id = c.id;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.sync_order_commission(text) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_order_commission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.sync_order_commission(NEW.id);
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS zz_order_commission ON public.shop_orders;
CREATE TRIGGER zz_order_commission AFTER INSERT OR UPDATE OF paid_cents, refunded_cents, status, referral_code, items_ex_gst, freight_ex_gst, total_inc_gst
  ON public.shop_orders FOR EACH ROW EXECUTE FUNCTION public.trg_order_commission();

-- Rate changes re-price every open (pending/approved) commission.
CREATE OR REPLACE FUNCTION public.recalc_open_commissions(p_ambassador uuid DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN SELECT order_id FROM ambassador_commissions
            WHERE status IN ('pending', 'approved') AND (p_ambassador IS NULL OR ambassador_id = p_ambassador) LOOP
    PERFORM sync_order_commission(r.order_id); n := n + 1;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.recalc_open_commissions(uuid) FROM public, anon, authenticated;

-- Existing paid referral orders get their commission rows now.
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT id FROM public.shop_orders WHERE referral_ambassador_id IS NOT NULL AND coalesce(paid_cents, 0) > 0 LOOP
    PERFORM public.sync_order_commission(r.id);
  END LOOP;
END $$;

------------------------------------------------------------------------------
-- 8. RPCs
------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_set_ambassador_setting(p_key text, p_value jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int := 0;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'Staff only' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF p_key = 'default_commission_rate' THEN
    IF NOT (p_value = 'null'::jsonb OR (jsonb_typeof(p_value) = 'number' AND (p_value #>> '{}')::numeric BETWEEN 0 AND 0.5)) THEN
      RAISE EXCEPTION 'The default rate is a fraction between 0 and 0.5 (e.g. 0.05 for 5%%), or empty' USING ERRCODE = 'check_violation';
    END IF;
  ELSIF p_key = 'commission_basis' THEN
    IF p_value NOT IN ('"items"'::jsonb, '"items_and_freight"'::jsonb) THEN RAISE EXCEPTION 'Unknown basis' USING ERRCODE = 'check_violation'; END IF;
  ELSIF p_key = 'guardian_method' THEN
    IF p_value NOT IN ('"staff"'::jsonb, '"email"'::jsonb) THEN RAISE EXCEPTION 'Guardian method is staff or email' USING ERRCODE = 'check_violation'; END IF;
  ELSIF p_key = 'guardian_link_days' THEN
    IF jsonb_typeof(p_value) <> 'number' OR (p_value #>> '{}')::int NOT BETWEEN 1 AND 60 THEN RAISE EXCEPTION 'Link days is 1-60' USING ERRCODE = 'check_violation'; END IF;
  ELSE
    RAISE EXCEPTION 'Unknown setting %', p_key USING ERRCODE = 'invalid_parameter_value';
  END IF;
  UPDATE ambassador_settings SET value = p_value, updated_at = now(), updated_by = auth.uid() WHERE key = p_key;
  IF p_key IN ('default_commission_rate', 'commission_basis') THEN n := recalc_open_commissions(NULL); END IF;
  RETURN jsonb_build_object('key', p_key, 'value', p_value, 'recalculated', n);
END $$;
REVOKE ALL ON FUNCTION public.staff_set_ambassador_setting(text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.staff_set_ambassador_setting(text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_set_ambassador_rate(p_ambassador uuid, p_rate numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'Staff only' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF p_rate IS NOT NULL AND (p_rate < 0 OR p_rate > 0.5) THEN
    RAISE EXCEPTION 'Rate is a fraction between 0 and 0.5, or empty for the default' USING ERRCODE = 'check_violation';
  END IF;
  INSERT INTO ambassador_terms (ambassador_id, commission_rate, updated_by) VALUES (p_ambassador, p_rate, auth.uid())
  ON CONFLICT (ambassador_id) DO UPDATE SET commission_rate = p_rate, updated_at = now(), updated_by = auth.uid();
  n := recalc_open_commissions(p_ambassador);
  RETURN jsonb_build_object('rate', p_rate, 'effective', ambassador_effective_rate(p_ambassador), 'recalculated', n);
END $$;
REVOKE ALL ON FUNCTION public.staff_set_ambassador_rate(uuid, numeric) FROM public;
GRANT EXECUTE ON FUNCTION public.staff_set_ambassador_rate(uuid, numeric) TO authenticated;

-- Guardian: the ambassador (or staff) records who the guardian is.
CREATE OR REPLACE FUNCTION public.ambassador_set_guardian(p_ambassador uuid, p_name text, p_email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a record; g record; v_email text := lower(btrim(coalesce(p_email, ''))); v_name text := left(btrim(coalesce(p_name, '')), 120);
BEGIN
  SELECT id, user_id, age_band INTO a FROM ambassadors WHERE id = p_ambassador;
  IF NOT FOUND OR NOT (public.is_staff() OR a.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT ambassador_is_minor(a.age_band) THEN RAISE EXCEPTION 'Guardian approval is only needed for under-18s' USING ERRCODE = 'check_violation'; END IF;
  IF length(v_name) < 2 THEN RAISE EXCEPTION 'Enter the guardian''s name' USING ERRCODE = 'check_violation'; END IF;
  IF v_email !~ '^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$' THEN RAISE EXCEPTION 'Enter a valid guardian email' USING ERRCODE = 'check_violation'; END IF;
  SELECT * INTO g FROM ambassador_guardians WHERE ambassador_id = a.id;
  UPDATE ambassador_guardians SET guardian_name = v_name, guardian_email = v_email,
    -- Changing who the guardian is needs a fresh approval.
    status = CASE WHEN g.guardian_email IS DISTINCT FROM v_email OR g.guardian_name IS DISTINCT FROM v_name THEN 'pending' ELSE status END,
    token_hash = CASE WHEN g.guardian_email IS DISTINCT FROM v_email THEN NULL ELSE token_hash END,
    updated_at = now()
  WHERE ambassador_id = a.id;
  RETURN public.guardian_status_json(a.id);
END $$;

CREATE OR REPLACE FUNCTION public.guardian_status_json(p_ambassador uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'required', ambassador_is_minor(a.age_band),
    'status', coalesce(g.status, CASE WHEN ambassador_is_minor(a.age_band) THEN 'pending' ELSE 'not_required' END),
    'guardian_name', coalesce(g.guardian_name, ''),
    'guardian_email', coalesce(g.guardian_email, ''),
    'method', g.method,
    'requested_at', g.requested_at,
    'decided_at', g.decided_at,
    'link_pending', g.token_hash IS NOT NULL AND g.token_expires > now(),
    'configured_method', coalesce(ambassador_setting('guardian_method') #>> '{}', 'staff'))
  FROM ambassadors a LEFT JOIN ambassador_guardians g ON g.ambassador_id = a.id
  WHERE a.id = p_ambassador
$$;
REVOKE ALL ON FUNCTION public.guardian_status_json(uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.ambassador_set_guardian(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.ambassador_set_guardian(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.my_guardian_status()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.guardian_status_json(id) FROM ambassadors WHERE user_id = auth.uid() LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.my_guardian_status() FROM public;
GRANT EXECUTE ON FUNCTION public.my_guardian_status() TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_guardian_signoff(p_ambassador uuid, p_note text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g record;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'Staff only' USING ERRCODE = 'insufficient_privilege'; END IF;
  SELECT * INTO g FROM ambassador_guardians WHERE ambassador_id = p_ambassador AND status <> 'not_required';
  IF NOT FOUND THEN RAISE EXCEPTION 'This ambassador doesn''t need guardian approval' USING ERRCODE = 'check_violation'; END IF;
  IF length(g.guardian_name) < 2 THEN RAISE EXCEPTION 'Record the guardian''s name first' USING ERRCODE = 'check_violation'; END IF;
  IF length(btrim(coalesce(p_note, ''))) < 3 THEN
    RAISE EXCEPTION 'Note how the guardian approved (e.g. signed form, phone call)' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE ambassador_guardians SET status = 'approved', method = 'staff', note = left(p_note, 500),
    decided_at = now(), decided_by = auth.uid(), token_hash = NULL, token_expires = NULL, updated_at = now()
  WHERE ambassador_id = p_ambassador;
  RETURN guardian_status_json(p_ambassador);
END $$;
REVOKE ALL ON FUNCTION public.staff_guardian_signoff(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.staff_guardian_signoff(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_guardian_decline(p_ambassador uuid, p_note text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'Staff only' USING ERRCODE = 'insufficient_privilege'; END IF;
  UPDATE ambassador_guardians SET status = 'declined', note = left(coalesce(p_note, ''), 500),
    decided_at = now(), decided_by = auth.uid(), token_hash = NULL, token_expires = NULL, updated_at = now()
  WHERE ambassador_id = p_ambassador AND status <> 'not_required';
  UPDATE ambassadors SET published = false WHERE id = p_ambassador AND published;
  RETURN guardian_status_json(p_ambassador);
END $$;
REVOKE ALL ON FUNCTION public.staff_guardian_decline(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.staff_guardian_decline(uuid, text) TO authenticated;

-- Email method: the guardian-consent edge function (service role) mints a single-use token.
-- Only its sha256 is stored; the raw token only ever goes into the guardian's email.
CREATE OR REPLACE FUNCTION public.create_guardian_token(p_ambassador uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  g record; a record;
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_days int := coalesce((ambassador_setting('guardian_link_days') #>> '{}')::int, 14);
BEGIN
  IF coalesce(ambassador_setting('guardian_method') #>> '{}', 'staff') <> 'email' THEN
    RAISE EXCEPTION 'Guardian approval is set to staff sign-off' USING ERRCODE = 'check_violation';
  END IF;
  SELECT id, name INTO a FROM ambassadors WHERE id = p_ambassador;
  SELECT * INTO g FROM ambassador_guardians WHERE ambassador_id = p_ambassador AND status IN ('pending', 'declined');
  IF NOT FOUND THEN RAISE EXCEPTION 'No guardian approval is waiting for this ambassador' USING ERRCODE = 'check_violation'; END IF;
  IF g.guardian_email !~ '@' THEN RAISE EXCEPTION 'Add the guardian''s email first' USING ERRCODE = 'check_violation'; END IF;
  IF g.token_hash IS NOT NULL AND g.requested_at > now() - interval '2 minutes' THEN RAISE EXCEPTION 'A link was just sent; try again in a few minutes' USING ERRCODE = 'check_violation'; END IF;
  UPDATE ambassador_guardians SET token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex'),
    token_expires = now() + make_interval(days => v_days), requested_at = now(), status = 'pending', updated_at = now()
  WHERE ambassador_id = p_ambassador;
  RETURN jsonb_build_object('token', v_token, 'guardian_email', g.guardian_email, 'guardian_name', g.guardian_name,
                            'ambassador_name', a.name, 'expires_days', v_days);
END $$;
REVOKE ALL ON FUNCTION public.create_guardian_token(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_guardian_token(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.guardian_link_info(p_token text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('ambassador_name', a.name, 'guardian_name', g.guardian_name, 'expires', g.token_expires)
  FROM ambassador_guardians g JOIN ambassadors a ON a.id = g.ambassador_id
  WHERE g.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
    AND g.token_expires > now() AND g.status = 'pending'
$$;
REVOKE ALL ON FUNCTION public.guardian_link_info(text) FROM public;
GRANT EXECUTE ON FUNCTION public.guardian_link_info(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.confirm_guardian_consent(p_token text, p_approve boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g record;
BEGIN
  SELECT g2.*, a.name AS ambassador_name INTO g FROM ambassador_guardians g2 JOIN ambassadors a ON a.id = g2.ambassador_id
   WHERE g2.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
     AND g2.token_expires > now() AND g2.status = 'pending'
   FOR UPDATE OF g2;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This link has expired or was already used. Ask the workshop for a new one.' USING ERRCODE = 'no_data_found';
  END IF;
  UPDATE ambassador_guardians SET status = CASE WHEN p_approve THEN 'approved' ELSE 'declined' END,
    method = 'email', decided_at = now(), decided_by = NULL, token_hash = NULL, token_expires = NULL,
    note = 'Confirmed by email link', updated_at = now()
  WHERE ambassador_id = g.ambassador_id;
  IF NOT p_approve THEN UPDATE ambassadors SET published = false WHERE id = g.ambassador_id AND published; END IF;
  RETURN jsonb_build_object('ok', true, 'approved', p_approve, 'ambassador_name', g.ambassador_name);
END $$;
REVOKE ALL ON FUNCTION public.confirm_guardian_consent(text, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.confirm_guardian_consent(text, boolean) TO anon, authenticated;

-- Payouts: staff mark approved commissions as paid in one batch.
CREATE OR REPLACE FUNCTION public.staff_mark_payout(p_ambassador uuid, p_commissions uuid[], p_reference text, p_note text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_total int; v_count int; v_bad int; v_id uuid; a record;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'Staff only' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF coalesce(array_length(p_commissions, 1), 0) = 0 THEN RAISE EXCEPTION 'Pick at least one commission' USING ERRCODE = 'check_violation'; END IF;
  IF length(btrim(coalesce(p_reference, ''))) < 2 THEN RAISE EXCEPTION 'Add the payment reference' USING ERRCODE = 'check_violation'; END IF;
  SELECT id, name, age_band INTO a FROM ambassadors WHERE id = p_ambassador;
  IF ambassador_is_minor(a.age_band) AND coalesce((SELECT status FROM ambassador_guardians WHERE ambassador_id = a.id), 'pending') <> 'approved' THEN
    RAISE EXCEPTION 'A guardian must approve % before payouts', a.name USING ERRCODE = 'check_violation';
  END IF;
  PERFORM 1 FROM ambassador_commissions WHERE id = ANY (p_commissions) FOR UPDATE;
  SELECT count(*) FILTER (WHERE ambassador_id <> p_ambassador OR status <> 'approved' OR amount_cents IS NULL),
         count(*), coalesce(sum(amount_cents), 0)
    INTO v_bad, v_count, v_total
    FROM ambassador_commissions WHERE id = ANY (p_commissions);
  IF v_count <> array_length(p_commissions, 1) OR v_bad > 0 THEN
    RAISE EXCEPTION 'Only approved, calculated commissions for this ambassador can be paid' USING ERRCODE = 'check_violation';
  END IF;
  INSERT INTO ambassador_payouts (ambassador_id, total_cents, commission_count, reference, note, created_by)
  VALUES (p_ambassador, v_total, v_count, left(btrim(p_reference), 120), left(coalesce(p_note, ''), 500), auth.uid())
  RETURNING id INTO v_id;
  UPDATE ambassador_commissions SET status = 'paid', paid_at = now(), payout_id = v_id, updated_at = now()
   WHERE id = ANY (p_commissions);
  RETURN jsonb_build_object('payout_id', v_id, 'total_cents', v_total, 'count', v_count);
END $$;
REVOKE ALL ON FUNCTION public.staff_mark_payout(uuid, uuid[], text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.staff_mark_payout(uuid, uuid[], text, text) TO authenticated;

-- Report rows for the staff payouts screen and CSV export.
CREATE OR REPLACE FUNCTION public.staff_commission_report(p_from date DEFAULT NULL, p_to date DEFAULT NULL, p_status text DEFAULT NULL)
RETURNS TABLE (
  commission_id uuid, ambassador_id uuid, ambassador_name text, ambassador_code text, order_id text,
  invoice_number text, order_date timestamptz, basis_ex_gst integer, rate numeric, amount_cents integer,
  status text, void_reason text, approved_at timestamptz, paid_at timestamptz, payout_reference text, guardian_ok boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'Staff only' USING ERRCODE = 'insufficient_privilege'; END IF;
  RETURN QUERY
  SELECT c.id, a.id, a.name, a.code, o.id, o.invoice_number, o.created_at, c.basis_ex_gst, c.rate, c.amount_cents,
         c.status, c.void_reason, c.approved_at, c.paid_at, p.reference,
         (NOT ambassador_is_minor(a.age_band) OR g.status = 'approved')
  FROM ambassador_commissions c
  JOIN ambassadors a ON a.id = c.ambassador_id
  JOIN shop_orders o ON o.id = c.order_id
  LEFT JOIN ambassador_payouts p ON p.id = c.payout_id
  LEFT JOIN ambassador_guardians g ON g.ambassador_id = a.id
  WHERE (p_from IS NULL OR o.created_at >= p_from)
    AND (p_to IS NULL OR o.created_at < p_to + 1)
    AND (p_status IS NULL OR c.status = p_status)
  ORDER BY o.created_at DESC;
END $$;
REVOKE ALL ON FUNCTION public.staff_commission_report(date, date, text) FROM public;
GRANT EXECUTE ON FUNCTION public.staff_commission_report(date, date, text) TO authenticated;

-- Dashboard for an ambassador (their own) or staff (any). No customer details.
CREATE OR REPLACE FUNCTION public.ambassador_dashboard(p_ambassador uuid DEFAULT NULL, p_days integer DEFAULT 90)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE a record; v_from timestamptz; v_rate numeric; v_own numeric;
BEGIN
  IF p_ambassador IS NULL THEN
    SELECT * INTO a FROM ambassadors WHERE user_id = auth.uid() LIMIT 1;
  ELSE
    SELECT * INTO a FROM ambassadors WHERE id = p_ambassador;
    IF FOUND AND NOT (public.is_staff() OR a.user_id = auth.uid()) THEN
      RAISE EXCEPTION 'Not allowed' USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  IF a.id IS NULL THEN RETURN NULL; END IF;
  v_from := now() - make_interval(days => greatest(1, least(coalesce(p_days, 90), 730)));
  v_rate := ambassador_effective_rate(a.id);
  SELECT commission_rate INTO v_own FROM ambassador_terms WHERE ambassador_id = a.id;
  RETURN jsonb_build_object(
    'ambassador', jsonb_build_object('id', a.id, 'name', a.name, 'code', a.code, 'slug', a.slug, 'published', a.published),
    'days', greatest(1, least(coalesce(p_days, 90), 730)),
    'rate', v_rate,
    'rate_source', CASE WHEN v_own IS NOT NULL THEN 'ambassador' WHEN v_rate IS NOT NULL THEN 'default' ELSE 'unset' END,
    'clicks', (SELECT count(*) FROM referral_clicks WHERE ambassador_id = a.id AND created_at >= v_from),
    'visitors', (SELECT count(DISTINCT visitor_hash) FROM referral_clicks WHERE ambassador_id = a.id AND created_at >= v_from),
    'clicks_by_day', coalesce((SELECT jsonb_agg(jsonb_build_object('day', d, 'clicks', n) ORDER BY d)
        FROM (SELECT day d, count(*) n FROM referral_clicks WHERE ambassador_id = a.id AND created_at >= v_from GROUP BY day) x), '[]'),
    'leads', (SELECT count(*) FROM quotes WHERE referral_code = a.code AND created_at >= v_from)
           + (SELECT count(*) FROM support_tickets WHERE referral_code = a.code AND created_at >= v_from),
    'orders', (SELECT count(*) FROM shop_orders WHERE referral_ambassador_id = a.id AND created_at >= v_from AND status <> 'cancelled'),
    'sales', (SELECT count(*) FROM ambassador_commissions c JOIN shop_orders o ON o.id = c.order_id
               WHERE c.ambassador_id = a.id AND c.status <> 'void' AND o.created_at >= v_from),
    'sales_ex_gst', (SELECT coalesce(sum(c.basis_ex_gst), 0) FROM ambassador_commissions c JOIN shop_orders o ON o.id = c.order_id
               WHERE c.ambassador_id = a.id AND c.status <> 'void' AND o.created_at >= v_from),
    'earnings', jsonb_build_object(
      'pending', (SELECT coalesce(sum(amount_cents), 0) FROM ambassador_commissions WHERE ambassador_id = a.id AND status = 'pending'),
      'approved', (SELECT coalesce(sum(amount_cents), 0) FROM ambassador_commissions WHERE ambassador_id = a.id AND status = 'approved'),
      'paid', (SELECT coalesce(sum(amount_cents), 0) FROM ambassador_commissions WHERE ambassador_id = a.id AND status = 'paid'),
      'uncalculated', (SELECT count(*) FROM ambassador_commissions WHERE ambassador_id = a.id AND status IN ('pending', 'approved') AND amount_cents IS NULL)),
    'commissions', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'ref', '…' || right(o.id, 4), 'date', o.created_at, 'basis_ex_gst', c.basis_ex_gst, 'rate', c.rate,
        'amount_cents', c.amount_cents, 'status', c.status, 'void_reason', c.void_reason, 'paid_at', c.paid_at) ORDER BY o.created_at DESC)
        FROM (SELECT * FROM ambassador_commissions WHERE ambassador_id = a.id ORDER BY created_at DESC LIMIT 50) c
        JOIN shop_orders o ON o.id = c.order_id), '[]'),
    'guardian', guardian_status_json(a.id));
END $$;
REVOKE ALL ON FUNCTION public.ambassador_dashboard(uuid, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.ambassador_dashboard(uuid, integer) TO authenticated;
