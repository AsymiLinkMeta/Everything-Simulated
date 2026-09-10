-- Stripe + mail columns. Lookup returns invoice / paid amounts for the track page.

ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS stripe_session_id text;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS stripe_payment_intent text;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS deposit_ex_gst integer NOT NULL DEFAULT 0;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS paid_cents integer NOT NULL DEFAULT 0;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS refunded_cents integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS mail_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text,
  ticket_id text,
  kind text NOT NULL,
  to_email text NOT NULL,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE mail_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_select_mail" ON mail_log;
CREATE POLICY "staff_select_mail" ON mail_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()::text
        AND profiles.role IN ('sales','workshop','content','support','admin')
    )
  );

CREATE OR REPLACE FUNCTION lookup_guest_order(p_order_id text, p_email text)
RETURNS TABLE(
  id text,
  status text,
  total_ex_gst integer,
  total_inc_gst integer,
  tracking_number text,
  carrier text,
  notes text,
  created_at timestamptz,
  invoice_number text,
  paid_cents integer,
  refunded_cents integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_email text;
BEGIN
  SELECT c.email INTO v_contact_email
    FROM crm_contacts c
    JOIN shop_orders o ON o.contact_id = c.id
    WHERE o.id = p_order_id
    LIMIT 1;

  IF v_contact_email IS NULL OR lower(v_contact_email) <> lower(p_email) THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT o.id, o.status, o.total_ex_gst, o.total_inc_gst, o.tracking_number, o.carrier, o.notes, o.created_at,
           o.invoice_number, o.paid_cents, o.refunded_cents
    FROM shop_orders o
    WHERE o.id = p_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION lookup_guest_order(text, text) TO anon, authenticated;
