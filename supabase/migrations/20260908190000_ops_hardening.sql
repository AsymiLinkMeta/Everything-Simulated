/*
Ops hardening: draft/publish, inventory, compatibility rules, customer orders, last-admin lock, seed catalogue.
Bolt/Supabase compatible — no TanStack server functions.
*/

alter table public.catalog_products add column if not exists listing_status text not null default 'published';
alter table public.catalog_products add column if not exists qty_on_hand integer not null default 0;
alter table public.catalog_products add column if not exists cost_ex_gst integer not null default 0;
alter table public.catalog_products add column if not exists max_nm integer;
alter table public.catalog_products add column if not exists payload_kg integer;
alter table public.catalog_products add column if not exists weight_kg integer;
alter table public.catalog_products add column if not exists mounts text[];
alter table public.catalog_products add column if not exists qr text;
alter table public.catalog_products add column if not exists image text;

update public.catalog_products set listing_status = 'published' where listing_status is null or listing_status = '';

drop policy if exists "public_select_catalog_products" on public.catalog_products;
create policy "public_select_catalog_products" on public.catalog_products for select
  to anon, authenticated
  using (listing_status = 'published' or public.is_staff());

-- Compatibility rules (staff editable, public readable)
create table if not exists public.compatibility_rules (
  id text primary key,
  left_sku text not null,
  right_sku text not null,
  severity text not null default 'warn',
  reason text not null,
  adapter_sku text,
  created_at timestamptz not null default now()
);
alter table public.compatibility_rules enable row level security;
drop policy if exists "public_select_compatibility_rules" on public.compatibility_rules;
create policy "public_select_compatibility_rules" on public.compatibility_rules for select
  to anon, authenticated using (true);
drop policy if exists "staff_write_compatibility_rules" on public.compatibility_rules;
create policy "staff_write_compatibility_rules" on public.compatibility_rules for all
  to authenticated using (public.is_staff()) with check (public.is_staff());

insert into public.compatibility_rules (id, left_sku, right_sku, severity, reason, adapter_sku) values
  ('qr-neo', 'gt-neo', 'alpha-evo-12', 'allow', 'Simagic QR matches Alpha EVO.', null),
  ('qr-neo-15', 'gt-neo', 'alpha-15', 'allow', 'Simagic QR matches Alpha 15Nm.', null),
  ('sr2-tr120', 'sr2', 'tr120s', 'block', 'SR2 is not rated on the TR120S deck. Upgrade to Exodus XR1.', null),
  ('sr2-xr1', 'sr2', 'xr1', 'allow', 'XR1 is motion-ready within SR2 payload.', null),
  ('hyd-tr120', 'p1000-haptic', 'tr120s', 'warn', 'Hydraulic P1000 needs the heavy pedal tray on TR120S.', null),
  ('alpha-tr120', 'alpha-evo-12', 'tr120s', 'adapter', 'Alpha EVO on TR120S needs the Simagic side-mount kit.', 'side-mount'),
  ('alpha15-tr120', 'alpha-15', 'tr120s', 'warn', '15Nm is at the TR120S torque ceiling. XR1 is the stiffer home.', null),
  ('quad-tr120', 'quad-mount', 'tr120s', 'block', 'Four-screen frame is specified on Exodus XR1 only.', null)
on conflict (id) do nothing;

-- Seed core SKUs so packages/checker work even on a fresh Bolt project
insert into public.catalog_products (sku, brand, name, category, sell_ex_gst, stock_status, listing_status, lead_weeks_min, lead_weeks_max, description, notes, max_nm, payload_kg, weight_kg, mounts, qr, image, qty_on_hand)
values
  ('tr120s','Trak Racer','TR120S V2 Chassis','chassis',0,'indent','published',3,6,'Trak Racer TR120S V2 chassis.','Starter Rig include.',15,180,null,array['tr_front_plate'],null,'/rigs/starter.jpg',0),
  ('xr1','Exodus','XR1 Heavy-Duty Racing Frame','chassis',0,'indent','published',3,6,'Exodus XR1 heavy-duty racing frame.','Haptic and Motion include.',28,260,null,array['exodus_deck','simagic_side'],null,'/rigs/haptic.jpg',0),
  ('alpha-evo-12','Simagic','Alpha EVO 12nm Direct Drive Wheelbase','wheelbase',0,'indent','published',3,6,'Simagic Alpha EVO 12Nm.','Starter Rig include.',12,null,null,array['simagic_side','tr_front_plate'],'simagic_qr',null,0),
  ('alpha-15','Simagic','Alpha 15nm Wheelbase','wheelbase',0,'indent','published',3,6,'Simagic Alpha 15Nm.','Haptic and Motion include.',15,null,null,array['simagic_side','exodus_deck'],'simagic_qr',null,0),
  ('gt-neo','Simagic','GT NEO Wheel','wheel',0,'indent','published',3,6,'Simagic GT NEO.','Included on packaged builds.',null,null,null,null,'simagic_qr',null,0),
  ('p1000','Simagic','P1000 Pedals','pedals',0,'indent','published',3,6,'Simagic P1000 pedals.','Starter Rig include.',null,null,8,null,null,null,0),
  ('p1000-haptic','Simagic','P1000 Pedals with Hydraulic Brake and Haptics','pedals',0,'indent','published',3,6,'Hydraulic P1000 with haptics.','Haptic and Motion include.',null,null,12,null,null,null,0),
  ('seq-shifter','Simagic','Sequential Shifter','shifter',0,'indent','published',3,6,'Simagic sequential shifter.','Included on packaged builds.',null,null,null,null,null,null,0),
  ('handbrake','Simagic','Handbrake','handbrake',0,'indent','published',3,6,'Simagic handbrake.','Starter Rig include.',null,null,null,null,null,null,0),
  ('touring-seat','Everything Simulated','Large Touring Race Seat','seat',0,'indent','published',3,6,'Large touring race seat.','Haptic and Motion include.',null,null,14,null,null,'/rigs/haptic.jpg',0),
  ('sr2','SIMRIG','SR2 Motion System','motion',0,'indent','published',4,6,'SIMRIG SR2 3-DOF. XR1 only.','Motion package include.',null,225,48,null,null,'/rigs/motion.jpg',0),
  ('aoc-32','AOC','32-inch Curved 240Hz Monitor','monitor',0,'indent','published',3,6,'AOC 32-inch 240Hz curved.','Triple screens on packaged builds.',null,null,7,null,null,'/rigs/haptic.jpg',0),
  ('aux-27','Everything Simulated','27-inch 100Hz Auxiliary Monitor','monitor',0,'indent','published',3,6,'Aux coaching screen.','Haptic and Motion include.',null,null,4,null,null,null,0),
  ('quad-mount','Everything Simulated','Free-standing 4-screen Monitor Frame','mount',0,'indent','published',3,6,'Four-screen frame. Exodus only.','Blocked on TR120S.',null,null,null,null,null,'/rigs/haptic.jpg',0),
  ('pc-starter','Everything Simulated','Brand-new Gaming PC optimised for racing titles','pc',0,'indent','published',3,6,'Race-optimised PC.','Starter Rig include.',null,null,null,null,null,'/rigs/starter.jpg',0),
  ('pc-race','Everything Simulated','High-performance Racing PC (i9 / RTX 5070 Ti)','pc',0,'indent','published',3,6,'i9 / RTX 5070 Ti race PC.','Haptic and Motion include.',null,null,null,null,null,'/rigs/haptic.jpg',0),
  ('logi-surround','Logitech','1000W Surround Sound System','audio',0,'indent','published',3,6,'Logitech 1000W surround.','Included on packaged builds.',null,null,null,null,null,null,0),
  ('pro-x','Logitech','Pro X Headset','headset',0,'indent','published',3,6,'Logitech Pro X.','Haptic and Motion include.',null,null,null,null,null,null,0),
  ('iracing-12','iRacing','12-month iRacing Subscription','software',0,'stock','published',0,0,'12-month iRacing.','Haptic and Motion include.',null,null,null,null,null,null,2),
  ('iracing-skin','iRacing','Custom Sprintcar Skin','software',0,'indent','published',1,2,'Custom iRacing skin.','Haptic and Motion include.',null,null,null,null,null,null,0),
  ('livery','Everything Simulated','Custom Simulator Livery','accessory',0,'indent','published',2,4,'Custom simulator livery.','Haptic and Motion include.',null,null,null,null,null,null,0),
  ('side-mount','Simagic','Side Mount Kit for Trak Racer','adapter',0,'stock','published',1,2,'Simagic side mount for TR120S.','Required adapter.',null,null,null,null,null,null,4)
on conflict (sku) do nothing;

-- Customer can place their own pending orders
drop policy if exists "owner_insert_shop_orders" on public.shop_orders;
create policy "owner_insert_shop_orders" on public.shop_orders for insert
  to authenticated with check (user_id = auth.uid()::text);

drop policy if exists "staff_select_profiles" on public.profiles;
create policy "staff_select_profiles" on public.profiles for select
  to authenticated using (public.is_staff() or auth.uid()::text = user_id);

-- Last admin cannot be demoted
create or replace function public.prevent_last_admin_demotion()
returns trigger
language plpgsql
security definer
as $$
begin
  if old.role = 'admin' and new.role is distinct from 'admin' then
    if (select count(*) from public.profiles where role = 'admin' and user_id <> old.user_id) = 0 then
      raise exception 'Cannot demote the last admin';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_last_admin on public.profiles;
create trigger profiles_prevent_last_admin
  before update on public.profiles
  for each row execute procedure public.prevent_last_admin_demotion();

-- Staff can update quotes (convert to won)
drop policy if exists "staff_update_quotes" on public.quotes;
create policy "staff_update_quotes" on public.quotes for update
  to authenticated using (public.is_staff()) with check (public.is_staff());

-- Customers may attach their own CRM row when placing an order
drop policy if exists "owner_insert_crm_contacts" on public.crm_contacts;
create policy "owner_insert_crm_contacts" on public.crm_contacts for insert
  to authenticated with check (user_id = auth.uid()::text);
drop policy if exists "owner_select_own_crm_contacts" on public.crm_contacts;
create policy "owner_select_own_crm_contacts" on public.crm_contacts for select
  to authenticated using (user_id = auth.uid()::text);

