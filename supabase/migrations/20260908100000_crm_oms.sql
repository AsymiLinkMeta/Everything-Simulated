/*
# CRM + OMS

Leads, activity notes, and shop orders for the staff portal.
Staff-only via is_staff(). Catalogue listings gain image + manufacturer URL fields.
*/

alter table public.catalog_products add column if not exists image_url text;
alter table public.catalog_products add column if not exists images jsonb not null default '[]'::jsonb;
alter table public.catalog_products add column if not exists manufacturer_url text;

create table if not exists public.crm_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  display_name text not null,
  email text,
  phone text,
  postcode text,
  address text,
  crm_stage text not null default 'lead',
  crm_source text,
  crm_owner_id text,
  follow_up_at date,
  tags jsonb not null default '[]'::jsonb,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists crm_contacts_stage_idx on public.crm_contacts (crm_stage);
create index if not exists crm_contacts_email_idx on public.crm_contacts (email);

alter table public.crm_contacts enable row level security;

drop policy if exists "staff_select_crm_contacts" on public.crm_contacts;
create policy "staff_select_crm_contacts" on public.crm_contacts for select
  to authenticated using (public.is_staff());
drop policy if exists "staff_insert_crm_contacts" on public.crm_contacts;
create policy "staff_insert_crm_contacts" on public.crm_contacts for insert
  to authenticated with check (public.is_staff());
drop policy if exists "staff_update_crm_contacts" on public.crm_contacts;
create policy "staff_update_crm_contacts" on public.crm_contacts for update
  to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "staff_delete_crm_contacts" on public.crm_contacts;
create policy "staff_delete_crm_contacts" on public.crm_contacts for delete
  to authenticated using (public.is_admin());

create table if not exists public.crm_notes (
  id serial primary key,
  contact_id uuid not null references public.crm_contacts(id) on delete cascade,
  actor_id text not null,
  kind text not null default 'note',
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists crm_notes_contact_idx on public.crm_notes (contact_id, created_at desc);

alter table public.crm_notes enable row level security;
drop policy if exists "staff_select_crm_notes" on public.crm_notes;
create policy "staff_select_crm_notes" on public.crm_notes for select
  to authenticated using (public.is_staff());
drop policy if exists "staff_insert_crm_notes" on public.crm_notes;
create policy "staff_insert_crm_notes" on public.crm_notes for insert
  to authenticated with check (public.is_staff());

create table if not exists public.shop_orders (
  id text primary key,
  contact_id uuid references public.crm_contacts(id),
  user_id text,
  quote_id text,
  status text not null default 'pending',
  lines jsonb not null default '[]'::jsonb,
  total_ex_gst integer not null default 0,
  total_inc_gst integer not null default 0,
  shipping_name text,
  shipping_address text,
  postcode text,
  tracking_number text,
  carrier text not null default 'ES Crate Freight',
  invoice_number text,
  notes text not null default '',
  return_reason text,
  packed_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists shop_orders_status_idx on public.shop_orders (status);
create index if not exists shop_orders_contact_idx on public.shop_orders (contact_id);

alter table public.shop_orders enable row level security;
drop policy if exists "staff_select_shop_orders" on public.shop_orders;
create policy "staff_select_shop_orders" on public.shop_orders for select
  to authenticated using (public.is_staff());
drop policy if exists "staff_insert_shop_orders" on public.shop_orders;
create policy "staff_insert_shop_orders" on public.shop_orders for insert
  to authenticated with check (public.is_staff());
drop policy if exists "staff_update_shop_orders" on public.shop_orders;
create policy "staff_update_shop_orders" on public.shop_orders for update
  to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "owner_select_shop_orders" on public.shop_orders;
create policy "owner_select_shop_orders" on public.shop_orders for select
  to authenticated using (user_id = auth.uid()::text);
