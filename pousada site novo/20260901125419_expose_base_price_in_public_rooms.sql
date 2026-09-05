/*
# Expose base_price in public_rooms_for_booking

## Purpose
The public booking form needs room prices to calculate the total in real time.
Currently the SECURITY DEFINER function only returns id, name, max_adults,
max_children — but NOT base_price. The rooms table itself is authenticated-only,
so the anon-key client cannot fetch prices directly.

## Changes
- DROP and recreate public_rooms_for_booking() to also return base_price.
- This is safe: showing a nightly rate to a prospective guest is intentional.
*/

DROP FUNCTION IF EXISTS public_rooms_for_booking();

CREATE FUNCTION public_rooms_for_booking()
RETURNS TABLE (
  id uuid,
  name text,
  max_adults integer,
  max_children integer,
  base_price numeric(10,2)
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, max_adults, max_children, base_price
  FROM rooms
  WHERE status IN ('available', 'active')
  ORDER BY name;
$$;

GRANT EXECUTE ON FUNCTION public_rooms_for_booking() TO anon, authenticated;
