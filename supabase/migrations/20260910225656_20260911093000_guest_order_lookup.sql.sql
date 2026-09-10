/*
# Guest order lookup function

Adds a SECURITY DEFINER function that lets a guest look up their order by
order ID + email. The function verifies the email matches the linked
crm_contacts row, then returns the order data. This is needed because
crm_contacts is staff-only SELECT — the anon key cannot read it directly.

## New Functions

### lookup_guest_order(p_order_id text, p_email text)
Returns the shop_orders row if the email matches the linked contact.
Returns NULL if no match or email mismatch.
*/

CREATE OR REPLACE FUNCTION lookup_guest_order(p_order_id text, p_email text)
RETURNS TABLE(
  id text,
  status text,
  total_ex_gst integer,
  total_inc_gst integer,
  tracking_number text,
  carrier text,
  notes text,
  created_at timestamptz
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
    RETURN QUERY SELECT NULL::text, NULL::text, NULL::integer, NULL::integer, NULL::text, NULL::text, NULL::text, NULL::timestamptz WHERE FALSE;
    RETURN;
  END IF;

  RETURN QUERY
    SELECT o.id, o.status, o.total_ex_gst, o.total_inc_gst, o.tracking_number, o.carrier, o.notes, o.created_at
    FROM shop_orders o
    WHERE o.id = p_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION lookup_guest_order(text, text) TO anon, authenticated;
