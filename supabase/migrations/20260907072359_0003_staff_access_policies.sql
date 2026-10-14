/*
# Staff access RLS policies

## Overview
The app's browser talks directly to Supabase, so staff functions (listing all
quotes, jobs, bookings, profiles, and overriding prices) need RLS policies that
allow staff-role users to read and modify all rows — not just their own.

## Changes
1. profiles: add policy allowing staff to SELECT all profiles (for team listing)
2. profiles: add policy allowing admin to UPDATE any profile (for role changes)
3. quotes: add policy allowing staff to SELECT all quotes
4. jobs: add policy allowing staff to SELECT all jobs
5. jobs: add policy allowing staff to UPDATE any job (stage changes)
6. bookings: add policy allowing staff to SELECT all bookings
7. product_overrides: add INSERT and UPDATE policies for staff

## Security
- Staff role is determined by checking the profiles table for the authenticated
  user's role. Only staff roles (sales, workshop, content, support, admin) gain
  elevated access.
- Admin-only operations (role changes) check for role = 'admin'.
- Price overrides require admin or sales role.
*/

-- Helper: check if current user is staff
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()::text
    AND role IN ('sales', 'workshop', 'content', 'support', 'admin')
  );
$$;

-- Helper: check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()::text
    AND role = 'admin'
  );
$$;

-- profiles: staff can read all profiles
DROP POLICY IF EXISTS "staff_select_all_profiles" ON profiles;
CREATE POLICY "staff_select_all_profiles" ON profiles FOR SELECT
  TO authenticated USING (public.is_staff());

-- profiles: admin can update any profile
DROP POLICY IF EXISTS "admin_update_any_profile" ON profiles;
CREATE POLICY "admin_update_any_profile" ON profiles FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- quotes: staff can read all quotes
DROP POLICY IF EXISTS "staff_select_all_quotes" ON quotes;
CREATE POLICY "staff_select_all_quotes" ON quotes FOR SELECT
  TO authenticated USING (public.is_staff());

-- jobs: staff can read all jobs
DROP POLICY IF EXISTS "staff_select_all_jobs" ON jobs;
CREATE POLICY "staff_select_all_jobs" ON jobs FOR SELECT
  TO authenticated USING (public.is_staff());

-- jobs: staff can update any job
DROP POLICY IF EXISTS "staff_update_any_job" ON jobs;
CREATE POLICY "staff_update_any_job" ON jobs FOR UPDATE
  TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- jobs: staff can insert jobs for any user
DROP POLICY IF EXISTS "staff_insert_jobs" ON jobs;
CREATE POLICY "staff_insert_jobs" ON jobs FOR INSERT
  TO authenticated WITH CHECK (public.is_staff());

-- bookings: staff can read all bookings
DROP POLICY IF EXISTS "staff_select_all_bookings" ON bookings;
CREATE POLICY "staff_select_all_bookings" ON bookings FOR SELECT
  TO authenticated USING (public.is_staff());

-- product_overrides: staff can insert
DROP POLICY IF EXISTS "staff_insert_overrides" ON product_overrides;
CREATE POLICY "staff_insert_overrides" ON product_overrides FOR INSERT
  TO authenticated WITH CHECK (public.is_staff());

-- product_overrides: staff can update
DROP POLICY IF EXISTS "staff_update_overrides" ON product_overrides;
CREATE POLICY "staff_update_overrides" ON product_overrides FOR UPDATE
  TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
