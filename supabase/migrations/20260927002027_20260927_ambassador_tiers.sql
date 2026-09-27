/*
# Add tier column to ambassadors

## Overview
Adds a `tier` column to the ambassadors table to support three sponsorship
levels: fully_sponsored, sponsored_driver, sponsored_customer.

## Modified Tables
- `ambassadors`
  - New column `tier` (text, not null, default 'sponsored_driver')
    Allowed values: fully_sponsored, sponsored_driver, sponsored_customer

## Notes
- Default is 'sponsored_driver' so existing rows get a sensible tier.
- Tier is admin-only — ambassadors cannot change their own tier.
*/

ALTER TABLE ambassadors
  ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'sponsored_driver';
