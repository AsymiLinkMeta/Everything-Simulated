-- Support tickets, messages and the staff inbox: customers and visitors can no longer
-- write the staff-owned fields.
--
-- Found in the Nov 2026 portal review (prod policies at the time):
--   * support_tickets "auth_insert_tickets" (WITH CHECK true) and "anon_insert_tickets" let a
--     caller insert a ticket with staff_reply / replied_by / replied_at already filled, for any
--     contact_email. Because customers can read tickets whose contact_email matches their login,
--     that put a forged "workshop reply" in someone else's account.
--   * "own_update_tickets" let a customer rewrite staff_reply, replied_by, status, user_id and
--     contact_email on their own ticket.
--   * support_messages accepted author_role = 'staff' (and any author_id) from customers and
--     from anon.
--   * staff_inbox accepted read_at from anon, so a notice could arrive already "read".
-- Staff (is_staff()) and server roles (service_role / postgres, e.g. edge functions) are
-- unaffected. NOT applied to prod: needs Patrick's OK.

create or replace function public.guard_support_ticket()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if current_user not in ('anon', 'authenticated') or public.is_staff() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.user_id := auth.uid()::text;            -- null for anon
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
    -- A customer reply re-opens the ticket; a customer may also close it.
    if new.status is distinct from old.status and new.status not in ('open', 'closed') then
      new.status := old.status;
    end if;
    new.updated_at := now();
  end if;
  return new;
end $$;

drop trigger if exists guard_support_ticket on public.support_tickets;
create trigger guard_support_ticket before insert or update on public.support_tickets
  for each row execute function public.guard_support_ticket();

create or replace function public.guard_support_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if current_user not in ('anon', 'authenticated') or public.is_staff() then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    raise exception 'Messages cannot be edited' using errcode = 'insufficient_privilege';
  end if;
  new.author_id := auth.uid()::text;
  if new.author_role is distinct from 'system' then
    new.author_role := 'customer';
  end if;
  new.created_at := now();
  return new;
end $$;

drop trigger if exists guard_support_message on public.support_messages;
create trigger guard_support_message before insert or update on public.support_messages
  for each row execute function public.guard_support_message();

create or replace function public.guard_staff_inbox()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if current_user not in ('anon', 'authenticated') or public.is_staff() then
    return new;
  end if;
  new.read_at := null;
  new.created_at := now();
  if auth.uid() is not null then
    new.user_id := auth.uid()::text;
  else
    new.user_id := null;
  end if;
  return new;
end $$;

drop trigger if exists guard_staff_inbox on public.staff_inbox;
create trigger guard_staff_inbox before insert on public.staff_inbox
  for each row execute function public.guard_staff_inbox();
