-- Lock profile roles, first-admin via SECURITY DEFINER, agent memory/playbooks.

CREATE OR REPLACE FUNCTION public.bootstrap_profile(p_email text DEFAULT NULL, p_name text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid text := auth.uid()::text;
  v_row public.profiles;
  v_admins int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  SELECT * INTO v_row FROM public.profiles WHERE user_id = v_uid;
  IF FOUND THEN
    UPDATE public.profiles
      SET email = COALESCE(NULLIF(p_email, ''), email),
          display_name = COALESCE(NULLIF(p_name, ''), display_name)
      WHERE user_id = v_uid
      RETURNING * INTO v_row;
    RETURN to_jsonb(v_row);
  END IF;

  SELECT count(*) INTO v_admins FROM public.profiles WHERE role = 'admin';

  INSERT INTO public.profiles (user_id, email, display_name, role)
  VALUES (
    v_uid,
    NULLIF(p_email, ''),
    NULLIF(p_name, ''),
    CASE WHEN v_admins = 0 THEN 'admin' ELSE 'customer' END
  )
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_profile(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bootstrap_profile(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()::text AND role = 'admin'
    ) THEN
      RAISE EXCEPTION 'Role change not allowed';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_role ON public.profiles;
CREATE TRIGGER protect_profile_role
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_role();

DROP POLICY IF EXISTS "insert_own_profile" ON public.profiles;
CREATE POLICY "insert_own_profile" ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id AND role = 'customer');

CREATE TABLE IF NOT EXISTS public.agent_playbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agent_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'system',
  score int NOT NULL DEFAULT 1,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agent_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  target_kind text NOT NULL,
  target_id text,
  rating int NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_memory_kind_score_idx ON public.agent_memory (kind, score DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS agent_feedback_user_idx ON public.agent_feedback (user_id, created_at DESC);

ALTER TABLE public.agent_playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_playbooks" ON public.agent_playbooks;
DROP POLICY IF EXISTS "staff_playbooks_select" ON public.agent_playbooks;
DROP POLICY IF EXISTS "staff_playbooks_write" ON public.agent_playbooks;
CREATE POLICY "staff_playbooks_select" ON public.agent_playbooks FOR SELECT TO authenticated USING (is_staff() OR active);
CREATE POLICY "staff_playbooks_write" ON public.agent_playbooks FOR ALL TO authenticated
  USING (is_staff()) WITH CHECK (is_staff());

DROP POLICY IF EXISTS "staff_memory_select" ON public.agent_memory;
DROP POLICY IF EXISTS "staff_memory_write" ON public.agent_memory;
CREATE POLICY "staff_memory_select" ON public.agent_memory FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff_memory_write" ON public.agent_memory FOR ALL TO authenticated
  USING (is_staff()) WITH CHECK (is_staff());

DROP POLICY IF EXISTS "own_feedback_insert" ON public.agent_feedback;
DROP POLICY IF EXISTS "own_feedback_select" ON public.agent_feedback;
CREATE POLICY "own_feedback_insert" ON public.agent_feedback FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "own_feedback_select" ON public.agent_feedback FOR SELECT TO authenticated
  USING (user_id = auth.uid()::text OR is_staff());

CREATE OR REPLACE FUNCTION public.record_agent_memory(
  p_kind text,
  p_title text,
  p_body text,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_source text DEFAULT 'system'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.agent_memory (kind, title, body, payload, source, created_by)
  VALUES (p_kind, p_title, p_body, COALESCE(p_payload, '{}'::jsonb), p_source, auth.uid()::text)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_agent_memory(text, text, text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_agent_memory(text, text, text, jsonb, text) TO authenticated, anon;

INSERT INTO public.agent_playbooks (title, body, sort_order)
SELECT * FROM (VALUES
  ('Checker is law', 'Never override a checker block. Explain the exact issue and only suggest SKUs that exist in the catalogue. Adapter warnings should recommend the adapter SKU, not ignore it.', 1),
  ('Juniors', 'Juniors: adjustable seat, 12Nm unless a coach asks otherwise, book a Gold Coast demo for pedal spacing. Prefer Starter or Haptic.', 2),
  ('Motion', 'SIMRIG SR2 is Exodus XR1 only. TR120S + SR2 is blocked. Confirm driver + seat + screens stay under payload.', 3),
  ('Mounts', 'Alpha EVO on TR120S needs the Simagic side-mount kit. Four-screen frames are XR1 only.', 4),
  ('Comms', 'Tickets and replies stay in the customer app and staff inbox. Do not promise email invoices or Xero. Phone 0404 619 056.', 5)
) AS v(title, body, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.agent_playbooks);
