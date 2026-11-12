-- record_agent_memory is staff-only (Supabase advisor: anon could call it and write rows into
-- agent_memory, which feeds the staff assistant).
--
-- The one non-staff caller was checkout (placeOrder in the browser recorded a "won_bom" note).
-- That note now comes from the database itself when an order is created, with the server-priced
-- lines, so nothing is lost and the browser no longer needs the function.
-- NOT applied to prod: needs Patrick's OK.

create or replace function public.record_agent_memory(
  p_kind text, p_title text, p_body text, p_payload jsonb default '{}'::jsonb, p_source text default 'system')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  -- SECURITY DEFINER: current_user is the owner here, so check the caller's JWT role instead.
  if coalesce(auth.jwt() ->> 'role', '') in ('anon', 'authenticated') and not public.is_staff() then
    raise exception 'Staff only' using errcode = 'insufficient_privilege';
  end if;
  insert into public.agent_memory (kind, title, body, payload, source, created_by)
  values (p_kind, left(p_title, 200), left(p_body, 4000), coalesce(p_payload, '{}'::jsonb), p_source, auth.uid()::text)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.record_agent_memory(text, text, text, jsonb, text) from public, anon;
grant execute on function public.record_agent_memory(text, text, text, jsonb, text) to authenticated, service_role;

-- "Won" bill of materials for every new order (was written by the browser at checkout).
create or replace function public.trg_order_won_bom()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if jsonb_typeof(new.lines) = 'array' and jsonb_array_length(new.lines) > 0 then
    insert into public.agent_memory (kind, title, body, payload, source, created_by)
    values ('won_bom', 'Won ' || new.id,
            left((select string_agg(coalesce(l ->> 'qty', '1') || '× ' || coalesce(l ->> 'sku', '?'), ', ')
                    from jsonb_array_elements(new.lines) l), 4000),
            jsonb_build_object('orderId', new.id, 'lines', new.lines, 'totalExGst', new.total_ex_gst),
            'system', new.user_id);
  end if;
  return null;
end $$;
revoke all on function public.trg_order_won_bom() from public, anon, authenticated;
drop trigger if exists zz_order_won_bom on public.shop_orders;
create trigger zz_order_won_bom after insert on public.shop_orders
  for each row execute function public.trg_order_won_bom();
