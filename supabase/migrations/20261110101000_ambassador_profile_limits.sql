-- Ambassador self-edits: no renames, and photos only from our own site or storage bucket.
--
-- Before: the "ambassador_update_own" policy let a linked ambassador update their row directly
-- (not just through ambassador_self_update), so they could rename their public profile to
-- anything and point the photo at any URL on the internet (tracking pixels, off-brand or
-- inappropriate images shown on our site and in share images).
--
-- Now, for ambassadors editing their own row (staff are unaffected):
--   * name is staff-only ("Ask the workshop to change your name"). The public name is what
--     customers see next to ES branding, so a change goes through staff.
--   * photo must be empty, unchanged, a site image path (/rigs/..., /builder-rig/...), or the
--     public URL of an object that exists in our product-images storage bucket on our own
--     project. The project origin is kept in ambassador_settings.photo_storage_origin; this
--     migration fills it from the storage URLs staff already use in site_media.
-- NOT applied to prod: needs Patrick's OK.

insert into public.ambassador_settings (key, value, description)
select 'photo_storage_origin',
       coalesce((select to_jsonb(substring(url from '^(https://[^/]+)/storage/v1/object/public/'))
                   from public.site_media
                  where url ~ '^https://[^/]+/storage/v1/object/public/product-images/'
                  group by 1 order by count(*) desc limit 1), 'null'::jsonb),
       'Origin of our Supabase project (https://<ref>.supabase.co). Ambassador photos may point at its product-images bucket.'
on conflict (key) do nothing;

create or replace function public.ambassador_photo_ok(p_photo text)
returns boolean language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_origin text := public.ambassador_setting('photo_storage_origin') #>> '{}';
  v_prefix text;
  v_name text;
begin
  if p_photo is null or btrim(p_photo) = '' then return true; end if;
  if position('..' in p_photo) > 0 or position('//' in substr(p_photo, 9)) > 0 then return false; end if;
  -- Images deployed with the site.
  if p_photo ~ '^/(rigs|builder-rig)/[A-Za-z0-9_-][A-Za-z0-9._/-]*\.(jpe?g|png|webp|avif)$' then
    return true;
  end if;
  -- Our storage bucket, and only objects that exist.
  if v_origin is null or v_origin !~ '^https?://[^/]+$' then return false; end if;
  v_prefix := v_origin || '/storage/v1/object/public/product-images/';
  if left(p_photo, length(v_prefix)) <> v_prefix then return false; end if;
  v_name := split_part(substr(p_photo, length(v_prefix) + 1), '?', 1);
  if v_name !~ '\.(jpe?g|png|webp|avif)$' then return false; end if;
  return exists (select 1 from storage.objects where bucket_id = 'product-images' and name = v_name);
end $$;
revoke all on function public.ambassador_photo_ok(text) from public, anon;
grant execute on function public.ambassador_photo_ok(text) to authenticated;

-- Same guard as 20261016090000, plus the name and photo rules for self-edits.
create or replace function public.guard_ambassador_row()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_guardian text;
begin
  new.code := upper(btrim(new.code));
  if new.code !~ '^[A-Z0-9-]{3,24}$' then
    raise exception 'Ambassador codes are 3-24 letters, numbers or dashes' using errcode = 'check_violation';
  end if;
  -- SECURITY DEFINER means current_user is the owner here, so key off the caller's JWT instead.
  if tg_op = 'UPDATE' and auth.uid() is not null and not public.is_staff() then
    if new.code is distinct from old.code or new.slug is distinct from old.slug
       or new.published is distinct from old.published or new.tier is distinct from old.tier
       or new.user_id is distinct from old.user_id or new.sort_order is distinct from old.sort_order then
      raise exception 'Only staff can change the code, link, tier or publishing' using errcode = 'insufficient_privilege';
    end if;
    if new.name is distinct from old.name then
      raise exception 'Ask the workshop to change your name' using errcode = 'insufficient_privilege';
    end if;
    if new.photo is distinct from old.photo and not public.ambassador_photo_ok(new.photo) then
      raise exception 'Photos must be a site image (/rigs/...) or uploaded to our storage' using errcode = 'check_violation';
    end if;
  end if;
  if tg_op = 'UPDATE' and public.ambassador_is_minor(old.age_band) and not public.ambassador_is_minor(new.age_band)
     and auth.uid() is not null and not public.is_staff() then
    raise exception 'Ask the workshop to update your age band' using errcode = 'insufficient_privilege';
  end if;
  if new.published and public.ambassador_is_minor(new.age_band) then
    select status into v_guardian from ambassador_guardians where ambassador_id = new.id;
    if v_guardian is distinct from 'approved' then
      if tg_op = 'UPDATE' and old.published and new.age_band is distinct from old.age_band then
        new.published := false;
      else
        raise exception 'A guardian must approve % before this profile can be published', new.name
          using errcode = 'check_violation';
      end if;
    end if;
  end if;
  return new;
end $$;
