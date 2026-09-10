-- Threaded tickets + staff inbox. All comms land in the admin portal.
-- Customer tickets/messages persist by user_id and email.

CREATE TABLE IF NOT EXISTS support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_id text,
  author_role text NOT NULL DEFAULT 'customer',
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_messages_ticket_idx ON support_messages (ticket_id, created_at);

ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_ticket_messages" ON support_messages;
CREATE POLICY "select_ticket_messages" ON support_messages FOR SELECT
  TO authenticated
  USING (
    is_staff()
    OR EXISTS (
      SELECT 1 FROM support_tickets t
      WHERE t.id = support_messages.ticket_id
        AND (
          t.user_id = auth.uid()::text
          OR lower(t.contact_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
    )
  );

DROP POLICY IF EXISTS "insert_ticket_messages" ON support_messages;
CREATE POLICY "insert_ticket_messages" ON support_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    is_staff()
    OR EXISTS (
      SELECT 1 FROM support_tickets t
      WHERE t.id = support_messages.ticket_id
        AND (
          t.user_id = auth.uid()::text
          OR lower(t.contact_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
    )
  );

CREATE TABLE IF NOT EXISTS staff_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  from_email text,
  from_name text,
  user_id text,
  ticket_id uuid REFERENCES support_tickets(id) ON DELETE SET NULL,
  order_id text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staff_inbox_unread_idx ON staff_inbox (created_at DESC) WHERE read_at IS NULL;
ALTER TABLE staff_inbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_select_inbox" ON staff_inbox;
CREATE POLICY "staff_select_inbox" ON staff_inbox FOR SELECT TO authenticated USING (is_staff());

DROP POLICY IF EXISTS "staff_update_inbox" ON staff_inbox;
CREATE POLICY "staff_update_inbox" ON staff_inbox FOR UPDATE TO authenticated USING (is_staff()) WITH CHECK (is_staff());

DROP POLICY IF EXISTS "anyone_insert_inbox" ON staff_inbox;
CREATE POLICY "anyone_insert_inbox" ON staff_inbox FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "select_own_tickets" ON support_tickets;
CREATE POLICY "select_own_tickets" ON support_tickets FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()::text
    OR lower(contact_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

DROP POLICY IF EXISTS "own_update_tickets" ON support_tickets;
CREATE POLICY "own_update_tickets" ON support_tickets FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()::text
    OR lower(contact_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    OR is_staff()
  )
  WITH CHECK (
    user_id = auth.uid()::text
    OR lower(contact_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    OR is_staff()
  );

DROP POLICY IF EXISTS "staff_select_chat" ON chat_messages;
CREATE POLICY "staff_select_chat" ON chat_messages FOR SELECT
  TO authenticated
  USING (is_staff() OR auth.uid()::text = user_id);

DROP POLICY IF EXISTS "anon_insert_messages" ON support_messages;
CREATE POLICY "anon_insert_messages" ON support_messages FOR INSERT
  TO anon
  WITH CHECK (true);
INSERT INTO support_messages (ticket_id, author_role, body, created_at)
SELECT id, 'customer', body, created_at FROM support_tickets t
WHERE NOT EXISTS (SELECT 1 FROM support_messages m WHERE m.ticket_id = t.id);
