-- Ambassador profiles. Public read of published cards only.
-- Ambassador role can update their own row except published + code.

create table if not exists ambassadors (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  user_id text unique,
  name text not null default '',
  photo text,
  bio text not null default '',
  motorsport text not null default '',
  series text not null default '',
  class_name text not null default '',
  team_status text not null default '',
  base text not null default '',
  age_band text,
  crate text,
  code text not null unique,
  instagram text,
  tiktok text,
  youtube text,
  facebook text,
  published boolean not null default false,
  under_18 boolean not null default false,
  guardian_approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ambassadors_published_idx on ambassadors (published);
create index if not exists ambassadors_code_idx on ambassadors (code);

alter table ambassadors enable row level security;

drop policy if exists ambassadors_public_read on ambassadors;
create policy ambassadors_public_read on ambassadors
  for select using (published = true);

drop policy if exists ambassadors_own_read on ambassadors;
create policy ambassadors_own_read on ambassadors
  for select to authenticated
  using (user_id = auth.uid()::text);

drop policy if exists ambassadors_own_update on ambassadors;
create policy ambassadors_own_update on ambassadors
  for update to authenticated
  using (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text);

drop policy if exists ambassadors_staff_all on ambassadors;
create policy ambassadors_staff_all on ambassadors
  for all to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.user_id = auth.uid()::text
        and p.role in ('sales', 'workshop', 'content', 'support', 'admin')
    )
  )
  with check (
    exists (
      select 1 from profiles p
      where p.user_id = auth.uid()::text
        and p.role in ('sales', 'workshop', 'content', 'support', 'admin')
    )
  );

insert into ambassadors (slug, name, bio, motorsport, team_status, base, code, published)
values (
  'carter-cosgrove-racing',
  'Carter Cosgrove Racing',
  'A driver program the workshop has publicly stood with. Bio, series and socials are theirs to fill.',
  'Sprint / club racing',
  'Program',
  'Queensland',
  'COSGROVE',
  true
)
on conflict (slug) do nothing;
