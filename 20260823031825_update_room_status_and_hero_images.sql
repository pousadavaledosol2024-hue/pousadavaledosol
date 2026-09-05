/*
# Update room status options and add hero carousel images

## Purpose
1. Expand room status from ('active', 'maintenance') to include
   'available', 'occupied', 'maintenance', 'cleaning' for richer
   room management.
2. Add hero_images text[] column to inn_settings for the background
   carousel feature — stores multiple image URLs/Base64 strings.

## Changes

### rooms table
- status CHECK constraint updated to:
  ('available', 'occupied', 'maintenance', 'cleaning', 'active')
  ('active' kept for backward compat — existing rows remain valid)
- Existing 'active' rows migrated to 'available'.

### inn_settings table
- New column: hero_images text[] NOT NULL DEFAULT '{}'
  Stores multiple hero background image URLs for the carousel.

## Security
- No policy changes — existing RLS policies remain in place.
*/

-- Update rooms status constraint
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_status_check;
ALTER TABLE rooms ADD CONSTRAINT rooms_status_check
  CHECK (status IN ('available', 'occupied', 'maintenance', 'cleaning', 'active'));

-- Migrate existing 'active' rooms to 'available'
UPDATE rooms SET status = 'available' WHERE status = 'active';

-- Update the SECURITY DEFINER function to show available rooms (not just active)
CREATE OR REPLACE FUNCTION public_rooms_for_booking()
RETURNS TABLE (
  id uuid,
  name text,
  max_adults integer,
  max_children integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, max_adults, max_children
  FROM rooms
  WHERE status IN ('available', 'active')
  ORDER BY name;
$$;

GRANT EXECUTE ON FUNCTION public_rooms_for_booking() TO anon, authenticated;

-- Add hero_images column to inn_settings
ALTER TABLE inn_settings ADD COLUMN IF NOT EXISTS hero_images text[] NOT NULL DEFAULT '{}';
