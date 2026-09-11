-- Staff AI desk: quotes for customers, agent run history, memory scoring, extra playbooks.

ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS contact_id uuid;
CREATE INDEX IF NOT EXISTS quotes_contact_idx ON public.quotes (contact_id);

DROP POLICY IF EXISTS "staff_insert_quotes" ON public.quotes;
CREATE POLICY "staff_insert_quotes" ON public.quotes FOR INSERT
  TO authenticated WITH CHECK (public.is_staff());

CREATE TABLE IF NOT EXISTS public.agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  tool text NOT NULL,
  prompt text NOT NULL,
  reply text NOT NULL,
  proposed_lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  check_ok boolean,
  contact_id uuid,
  quote_id text,
  job_id int,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_runs_created_idx ON public.agent_runs (created_at DESC);
CREATE INDEX IF NOT EXISTS agent_runs_user_idx ON public.agent_runs (user_id, created_at DESC);

ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_runs" ON public.agent_runs;
CREATE POLICY "staff_runs" ON public.agent_runs FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

CREATE OR REPLACE FUNCTION public.score_agent_memory(p_id uuid, p_delta int)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_score int;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Staff only';
  END IF;
  UPDATE public.agent_memory
    SET score = GREATEST(-5, LEAST(20, score + GREATEST(-5, LEAST(5, p_delta))))
    WHERE id = p_id
    RETURNING score INTO v_score;
  RETURN COALESCE(v_score, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.score_agent_memory(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.score_agent_memory(uuid, int) TO authenticated;

INSERT INTO public.agent_playbooks (title, body, sort_order)
SELECT v.title, v.body, v.sort_order
FROM (VALUES
  ('Quote desk', 'Staff quotes are workshop specs, not invoices. List real SKUs, flag checker blocks, never invent a price that is not in the catalogue. 30% deposit, min $500, remainder on QA. Tickets stay in the app.', 6),
  ('CRM next action', 'One next action, one sentence why, then talking points. Do not invent a follow-up date the record does not have. Prefer a Gold Coast demo for juniors and first-time motion buyers.', 7),
  ('Job brief', 'Workshop notes only: BOM, checker holds, payload, mounts, crate freight. No sales fluff. Call out missing adapters and unique-category clashes.', 8),
  ('Staff desk', 'You are talking to ES staff, not the customer. Be terse and SKU-precise. proposedLines when speccing or fixing. Never override a checker block. Phone 0404 619 056.', 9)
) AS v(title, body, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.agent_playbooks p WHERE p.title = v.title);
