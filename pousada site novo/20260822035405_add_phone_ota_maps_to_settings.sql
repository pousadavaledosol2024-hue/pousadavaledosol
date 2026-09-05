-- Add phone and OTA booking URL columns to inn_settings
ALTER TABLE inn_settings ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT '';
ALTER TABLE inn_settings ADD COLUMN IF NOT EXISTS booking_url text NOT NULL DEFAULT '';
ALTER TABLE inn_settings ADD COLUMN IF NOT EXISTS airbnb_url text NOT NULL DEFAULT '';
ALTER TABLE inn_settings ADD COLUMN IF NOT EXISTS triplar_url text NOT NULL DEFAULT '';
ALTER TABLE inn_settings ADD COLUMN IF NOT EXISTS maps_lat text NOT NULL DEFAULT '';
ALTER TABLE inn_settings ADD COLUMN IF NOT EXISTS maps_lng text NOT NULL DEFAULT '';
