create table if not exists profiles (
  user_id text primary key,
  email text,
  display_name text,
  role text not null default 'customer',
  postcode text,
  created_at timestamptz not null default now()
);

create table if not exists quotes (
  id text primary key,
  user_id text not null,
  title text not null default 'Build',
  status text not null default 'draft',
  lines jsonb not null default '[]',
  check_ok boolean not null default false,
  total_ex_gst integer not null default 0,
  postcode text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists quotes_user_id_idx on quotes (user_id);

create table if not exists jobs (
  id serial primary key,
  user_id text not null,
  quote_id text,
  stage text not null default 'enquiry',
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists jobs_user_id_idx on jobs (user_id);

create table if not exists bookings (
  id serial primary key,
  user_id text not null,
  kind text not null default 'demo',
  slot text,
  status text not null default 'requested',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists chat_messages (
  id serial primary key,
  user_id text not null,
  role text not null,
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_user_id_idx on chat_messages (user_id);

create table if not exists product_overrides (
  sku text primary key,
  sell_ex_gst integer,
  stock_status text,
  updated_at timestamptz not null default now()
);
