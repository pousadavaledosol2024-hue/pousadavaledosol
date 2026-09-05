/*
# Create rooms, reservations, and iCal feeds tables

## Purpose
Full hotel management system: room inventory, reservation management,
iCal sync with OTAs (Airbnb, Booking.com, etc.), and public guest registration (FNRH).

## Tables

### rooms
Individual accommodations managed by the admin:
- id (uuid, pk)
- name — display name (e.g. "Quarto 1", "Chalé")
- description — room details
- max_adults (int, default 2)
- max_children (int, default 0)
- base_price (numeric, nightly rate)
- amenities (text[], array of amenity strings)
- status — 'active' | 'maintenance'
- min_stay (int, minimum nights, default 1)
- ical_export_token — unique token for generating the public .ics feed URL
- created_at, updated_at

### reservations
Bookings from all sources (direct, Airbnb, Booking, etc.):
- id (uuid, pk)
- room_id (uuid, fk -> rooms)
- guest_name (text, required)
- guest_document (text, CPF/passport)
- guest_email (text)
- guest_phone (text)
- guest_birth_date (date)
- check_in (date, required)
- check_out (date, required)
- num_adults (int, default 1)
- num_children (int, default 0)
- arrival_time (text, estimated arrival time)
- observations (text, special requests)
- accepted_terms (boolean, required true)
- status — 'pending' | 'confirmed' | 'cancelled' | 'blocked'
  (pending = new public submission, confirmed = admin approved,
   cancelled = rejected, blocked = iCal import block)
- source — 'direct' | 'airbnb' | 'booking' | 'triplar' | 'manual' | 'ical_import'
- total_price (numeric, nullable, set by admin)
- ical_uid (text, nullable, external ID from imported iCal events)
- created_at, updated_at

### ical_feeds
External iCal URLs to import (one per OTA channel per room):
- id (uuid, pk)
- room_id (uuid, fk -> rooms)
- source_name (text, e.g. "Airbnb", "Booking.com")
- feed_url (text, the .ics URL from the OTA)
- last_synced_at (timestamptz, nullable)
- enabled (boolean, default true)
- created_at

## Security
- RLS enabled on all new tables
- rooms: admin-only (authenticated). Public guests cannot see rooms directly;
  the public booking form fetches rooms via a SECURITY DEFINER function that
  returns only id + name + max_adults + max_children (no pricing or internal data).
- reservations: SELECT/UPDATE/DELETE for authenticated only. INSERT for anon
  (public form writes). The INSERT policy allows anon to insert but the
  SELECT policy blocks anon from reading any rows — true write-only access.
- ical_feeds: authenticated only (admin manages these).

## Important notes
1. A SECURITY DEFINER function `public_rooms_for_booking()` exposes only the
   safe columns of active rooms to the anon role, so the public form can show
   available rooms without exposing the full table.
2. Reservations use a write-only pattern: anon can INSERT but never SELECT.
   This is the LGPD data segregation requirement — guests submit data but
   can never read other guests' data.
3. ical_export_token is generated client-side (UUID) and stored; the edge
   function uses it to authorize .ics feed requests.
*/

-- ============ ROOMS ============
CREATE TABLE IF NOT EXISTS rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  max_adults integer NOT NULL DEFAULT 2,
  max_children integer NOT NULL DEFAULT 0,
  base_price numeric(10,2) NOT NULL DEFAULT 0,
  amenities text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance')),
  min_stay integer NOT NULL DEFAULT 1,
  ical_export_token uuid UNIQUE DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_rooms" ON rooms;
CREATE POLICY "auth_select_rooms" ON rooms FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_rooms" ON rooms;
CREATE POLICY "auth_insert_rooms" ON rooms FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_rooms" ON rooms;
CREATE POLICY "auth_update_rooms" ON rooms FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_rooms" ON rooms;
CREATE POLICY "auth_delete_rooms" ON rooms FOR DELETE
  TO authenticated USING (true);

-- ============ RESERVATIONS ============
CREATE TABLE IF NOT EXISTS reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  guest_name text NOT NULL,
  guest_document text NOT NULL DEFAULT '',
  guest_email text NOT NULL DEFAULT '',
  guest_phone text NOT NULL DEFAULT '',
  guest_birth_date date,
  check_in date NOT NULL,
  check_out date NOT NULL,
  num_adults integer NOT NULL DEFAULT 1,
  num_children integer NOT NULL DEFAULT 0,
  arrival_time text NOT NULL DEFAULT '',
  observations text NOT NULL DEFAULT '',
  accepted_terms boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'blocked')),
  source text NOT NULL DEFAULT 'direct' CHECK (source IN ('direct', 'airbnb', 'booking', 'triplar', 'manual', 'ical_import')),
  total_price numeric(10,2),
  ical_uid text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- Public can INSERT (write-only) but never SELECT
DROP POLICY IF EXISTS "anon_insert_reservations" ON reservations;
CREATE POLICY "anon_insert_reservations" ON reservations FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- Only authenticated (admin) can read, update, delete
DROP POLICY IF EXISTS "auth_select_reservations" ON reservations;
CREATE POLICY "auth_select_reservations" ON reservations FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_update_reservations" ON reservations;
CREATE POLICY "auth_update_reservations" ON reservations FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_reservations" ON reservations;
CREATE POLICY "auth_delete_reservations" ON reservations FOR DELETE
  TO authenticated USING (true);

-- ============ ICAL FEEDS ============
CREATE TABLE IF NOT EXISTS ical_feeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  source_name text NOT NULL,
  feed_url text NOT NULL,
  last_synced_at timestamptz,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ical_feeds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_ical_feeds" ON ical_feeds;
CREATE POLICY "auth_select_ical_feeds" ON ical_feeds FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_ical_feeds" ON ical_feeds;
CREATE POLICY "auth_insert_ical_feeds" ON ical_feeds FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_ical_feeds" ON ical_feeds;
CREATE POLICY "auth_update_ical_feeds" ON ical_feeds FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_ical_feeds" ON ical_feeds;
CREATE POLICY "auth_delete_ical_feeds" ON ical_feeds FOR DELETE
  TO authenticated USING (true);

-- ============ SECURITY DEFINER: public rooms for booking form ============
-- Returns only safe columns (id, name, max_adults, max_children) for active rooms.
-- This is the ONLY way the anon role can see room data — the rooms table itself
-- is authenticated-only.
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
  WHERE status = 'active'
  ORDER BY name;
$$;

GRANT EXECUTE ON FUNCTION public_rooms_for_booking() TO anon, authenticated;

-- Index for date-range queries (calendar, availability checks)
CREATE INDEX IF NOT EXISTS idx_reservations_room_dates ON reservations(room_id, check_in, check_out);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
