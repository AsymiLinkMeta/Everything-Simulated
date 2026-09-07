/*
# Profile insert policy

## Overview
Users need to be able to create their own profile row on first sign-in.
The existing policies only cover SELECT and UPDATE for own profile.
This adds an INSERT policy so a user can create their own row.

## Security
- Users can only insert a profile row with their own user_id.
*/

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid()::text = user_id);
