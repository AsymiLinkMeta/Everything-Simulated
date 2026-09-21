-- Ambassador role is not staff. Staff may flip customer <-> ambassador only.
-- Ambassadors cannot self-publish, change their code, or reassign the login.

create or replace function public.protect_ambassador_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  staff boolean;
begin
  staff := public.is_staff();
  if staff then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    new.published := old.published;
    new.code := old.code;
    new.user_id := old.user_id;
    new.guardian_approved := old.guardian_approved;
    new.slug := old.slug;
  end if;
  return new;
end;
$$;

drop trigger if exists ambassadors_protect_row on ambassadors;
create trigger ambassadors_protect_row
before update on ambassadors
for each row execute procedure public.protect_ambassador_row();

drop policy if exists staff_promote_ambassador on profiles;
create policy staff_promote_ambassador on profiles
  for update to authenticated
  using (public.is_staff() and role in ('customer', 'ambassador'))
  with check (public.is_staff() and role in ('customer', 'ambassador'));

comment on table ambassadors is 'Public cards + referral codes. Commission is settled off attributed order notes, not a checkout discount.';
