-- Test-only bootstrap for local/stack-nodocker.sh: the roles, schemas and storage tables the
-- supabase/postgres image would provide. Local throwaway passwords. Never run against a real project.
create role anon nologin noinherit; create role authenticated nologin noinherit; create role service_role nologin noinherit bypassrls;
create role supabase_admin superuser login createrole replication bypassrls password 'postgres';
create role authenticator login noinherit password 'postgres';
grant anon, authenticated, service_role to authenticator;
create role supabase_auth_admin login createrole noinherit password 'postgres';
create role supabase_storage_admin login createrole noinherit password 'postgres';
create role dashboard_user nologin createrole createdb replication;
create schema auth authorization supabase_auth_admin;
grant usage on schema auth to anon, authenticated, service_role, postgres;
alter role supabase_auth_admin set search_path = auth;
create schema extensions; create extension pgcrypto schema extensions; create extension "uuid-ossp" schema extensions;
grant usage on schema extensions to anon, authenticated, service_role, postgres;
alter database postgres set search_path = "$user", public, extensions;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
create schema storage authorization supabase_storage_admin;
grant usage on schema storage to anon, authenticated, service_role;
create table storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now(), updated_at timestamptz default now(), owner uuid);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets, name text, owner uuid, owner_id text, metadata jsonb, created_at timestamptz default now(), updated_at timestamptz default now(), last_accessed_at timestamptz, version text, path_tokens text[]);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
create function storage.filename(name text) returns text language sql immutable as $$ select (string_to_array(name,'/'))[array_length(string_to_array(name,'/'),1)] $$;
create function storage.extension(name text) returns text language sql immutable as $$ select reverse(split_part(reverse(name),'.',1)) $$;
grant all on storage.objects, storage.buckets to anon, authenticated, service_role;
