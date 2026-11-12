-- Guest tickets no longer attach to an account by email.
--
-- Before: a customer could read (and reply on) any ticket whose contact_email matched their
-- login, so a logged-out visitor could file a ticket "as" an existing customer and it showed up
-- in that customer's account, looking like something they had sent. Staff also had no way to
-- tell a verified account ticket from an unverified contact-form one.
--
-- Now:
--   * Customers see and reply on tickets where user_id is their own account, nothing else.
--   * Tickets from the public contact form keep user_id NULL ("guest, email not verified").
--     They never appear in an account on their own. Staff can attach one after checking it
--     (set user_id), and staff-created tickets for a known, verified email attach straight away.
--   * A signed-in customer's ticket always uses their account email.
--   * Visitors can only add messages to guest tickets, never to an account's ticket.
-- Prod had 0 support tickets when this was written, so no existing ticket changes visibility.
-- NOT applied to prod: needs Patrick's OK.

create or replace function public.guard_support_ticket()
returns trigger language plpgsql security invoker set search_path = public as $$
declare v_email text;
begin
  if current_user not in ('anon', 'authenticated') or public.is_staff() then
    -- Staff opening a ticket for a customer: attach it to the account with that verified email.
    if tg_op = 'INSERT' and new.user_id is null and public.is_staff() then
      new.user_id := public.support_account_for_email(new.contact_email);
    end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.user_id := auth.uid()::text;            -- null for anon: a guest ticket
    if auth.uid() is not null then
      v_email := public.support_account_email();
      if v_email is not null then
        new.contact_email := v_email;           -- signed in: always their own address
      end if;
    end if;
    new.status := 'open';
    new.staff_reply := null;
    new.replied_by := null;
    new.replied_at := null;
    new.created_at := now();
    new.updated_at := now();
  else
    new.id := old.id;
    new.user_id := old.user_id;
    new.contact_email := old.contact_email;
    new.staff_reply := old.staff_reply;
    new.replied_by := old.replied_by;
    new.replied_at := old.replied_at;
    new.created_at := old.created_at;
    new.referral_code := old.referral_code;
    if new.status is distinct from old.status and new.status not in ('open', 'closed') then
      new.status := old.status;
    end if;
    new.updated_at := now();
  end if;
  return new;
end $$;

-- The caller's own login email (auth.users is not readable by API roles).
create or replace function public.support_account_email()
returns text language sql stable security definer set search_path = public, pg_temp as $$
  select lower(email) from auth.users where id = auth.uid()
$$;
revoke all on function public.support_account_email() from public, anon;
grant execute on function public.support_account_email() to authenticated;

-- Staff only: the account (if any) that owns a verified email.
create or replace function public.support_account_for_email(p_email text)
returns text language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  -- SECURITY DEFINER: current_user is the owner here, so check the caller's JWT role instead.
  if coalesce(auth.jwt() ->> 'role', '') in ('anon', 'authenticated') and not public.is_staff() then
    return null;
  end if;
  return (select id::text from auth.users
           where lower(email) = lower(btrim(p_email)) and email_confirmed_at is not null
           limit 1);
end $$;
revoke all on function public.support_account_for_email(text) from public, anon;
grant execute on function public.support_account_for_email(text) to authenticated;

-- Visitors may only post into guest tickets (they cannot read support_tickets, hence definer).
create or replace function public.support_ticket_is_guest(p_ticket uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.support_tickets where id = p_ticket and user_id is null)
$$;
revoke all on function public.support_ticket_is_guest(uuid) from public;
grant execute on function public.support_ticket_is_guest(uuid) to anon, authenticated;

drop policy if exists select_own_tickets on public.support_tickets;
create policy select_own_tickets on public.support_tickets for select to authenticated
  using (user_id = (auth.uid())::text);

drop policy if exists own_update_tickets on public.support_tickets;
create policy own_update_tickets on public.support_tickets for update to authenticated
  using (user_id = (auth.uid())::text or public.is_staff())
  with check (user_id = (auth.uid())::text or public.is_staff());

drop policy if exists select_ticket_messages on public.support_messages;
create policy select_ticket_messages on public.support_messages for select to authenticated
  using (public.is_staff() or exists (
    select 1 from public.support_tickets t
     where t.id = support_messages.ticket_id and t.user_id = (auth.uid())::text));

drop policy if exists insert_ticket_messages on public.support_messages;
create policy insert_ticket_messages on public.support_messages for insert to authenticated
  with check (public.is_staff() or exists (
    select 1 from public.support_tickets t
     where t.id = support_messages.ticket_id and t.user_id = (auth.uid())::text));

drop policy if exists anon_insert_messages on public.support_messages;
create policy anon_insert_messages on public.support_messages for insert to anon
  with check (public.support_ticket_is_guest(ticket_id));
