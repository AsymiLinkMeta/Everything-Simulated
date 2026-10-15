/*
# Ambassador guards and referral tracking

## Overview
1. Adds a `referral_code` column to `shop_orders` so checkout can record
   which ambassador attributed the order — without mutating the ambassador
   table or exposing staff-only data.
2. Adds a guard trigger that validates any referral code stored on an order
   actually belongs to a published ambassador before the order is inserted
   or updated, preventing fake or stale codes from being silently stored.
3. Adds an `updated_at` auto-bump trigger to `ambassadors` so the column
   stays accurate without relying on the client.

## Modified Tables
- `shop_orders`
  - New column `referral_code` (text, nullable) — uppercase ambassador code
    or NULL when no code was used. Not a discount; purely attribution.

## New Triggers / Functions
- `validate_referral_code()` — BEFORE INSERT/UPDATE trigger function on
  shop_orders. If `referral_code` is non-NULL and non-empty, it must match
  a published ambassador's `code` (case-insensitive, stored uppercase).
  Otherwise the statement is allowed through with `referral_code` set to
  NULL so a bad code never blocks checkout — it is simply dropped.
- `bump_ambassador_updated_at()` — BEFORE UPDATE trigger function on
  ambassadors that sets `updated_at = now()` automatically.

## Security
- No new RLS policies required. The `referral_code` column on shop_orders
  inherits existing order policies (owner-scoped for customers, staff for
  all). The trigger runs with SECURITY DEFINER so it can read the
  ambassadors table regardless of the calling role.
*/

-- 1. Add referral_code column to shop_orders
ALTER TABLE shop_orders
  ADD COLUMN IF NOT EXISTS referral_code text;

-- 2. Guard function: validate referral code against published ambassadors
CREATE OR REPLACE FUNCTION public.validate_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalised text;
  matched_code text;
BEGIN
  IF NEW.referral_code IS NOT NULL AND btrim(NEW.referral_code) <> '' THEN
    normalised := upper(btrim(NEW.referral_code));
    SELECT code INTO matched_code
      FROM ambassadors
      WHERE code = normalised AND published = true
      LIMIT 1;
    IF matched_code IS NULL THEN
      -- Drop invalid / stale codes silently — never block checkout
      NEW.referral_code := NULL;
    ELSE
      NEW.referral_code := matched_code;
    END IF;
  ELSE
    NEW.referral_code := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_referral_code ON shop_orders;
CREATE TRIGGER trg_validate_referral_code
  BEFORE INSERT OR UPDATE OF referral_code ON shop_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_referral_code();

-- 3. Auto-bump updated_at on ambassadors
CREATE OR REPLACE FUNCTION public.bump_ambassador_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_ambassador_updated_at ON ambassadors;
CREATE TRIGGER trg_bump_ambassador_updated_at
  BEFORE UPDATE ON ambassadors
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_ambassador_updated_at();
