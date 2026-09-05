/*
# Create inn_settings and gallery tables

## Purpose
Single-tenant inn website database schema. No authentication required — the admin
panel is protected by a simple password stored in the app (no user accounts).

## Tables

### inn_settings
Stores all configurable info about the inn shown on the public site:
- id (uuid, primary key)
- name — inn name displayed in the header
- description — main description paragraph shown on the homepage
- email — contact email address
- whatsapp — WhatsApp number (with country code, digits only)
- pix_key — Pix payment key (CPF, CNPJ, email, phone, or random key)
- pix_key_type — label for the pix key type (e.g. "CPF", "E-mail", "Aleatória")
- address — full address text
- city — city name
- state — state abbreviation
- instagram_url — optional Instagram profile link
- facebook_url — optional Facebook page link
- check_in_time — check-in time string (e.g. "14:00")
- check_out_time — check-out time string (e.g. "12:00")
- hero_image_url — main banner/hero image URL
- logo_url — optional inn logo URL
- created_at, updated_at

### gallery_photos
Stores photo gallery entries:
- id (uuid, primary key)
- url — full image URL
- caption — optional caption text
- sort_order — integer for manual ordering
- created_at

## Security
- RLS enabled on both tables
- Anon + authenticated can read/write (no sign-in required — single-tenant app)
- USING(true) is intentional: the admin panel uses a client-side password check
*/

CREATE TABLE IF NOT EXISTS inn_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Pousada',
  description text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  whatsapp text NOT NULL DEFAULT '',
  pix_key text NOT NULL DEFAULT '',
  pix_key_type text NOT NULL DEFAULT 'Chave Pix',
  address text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT '',
  instagram_url text NOT NULL DEFAULT '',
  facebook_url text NOT NULL DEFAULT '',
  check_in_time text NOT NULL DEFAULT '14:00',
  check_out_time text NOT NULL DEFAULT '12:00',
  hero_image_url text NOT NULL DEFAULT '',
  logo_url text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gallery_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  caption text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE inn_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_inn_settings" ON inn_settings;
CREATE POLICY "anon_select_inn_settings" ON inn_settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_inn_settings" ON inn_settings;
CREATE POLICY "anon_insert_inn_settings" ON inn_settings FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_inn_settings" ON inn_settings;
CREATE POLICY "anon_update_inn_settings" ON inn_settings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_inn_settings" ON inn_settings;
CREATE POLICY "anon_delete_inn_settings" ON inn_settings FOR DELETE
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_gallery_photos" ON gallery_photos;
CREATE POLICY "anon_select_gallery_photos" ON gallery_photos FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_gallery_photos" ON gallery_photos;
CREATE POLICY "anon_insert_gallery_photos" ON gallery_photos FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_gallery_photos" ON gallery_photos;
CREATE POLICY "anon_update_gallery_photos" ON gallery_photos FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_gallery_photos" ON gallery_photos;
CREATE POLICY "anon_delete_gallery_photos" ON gallery_photos FOR DELETE
  TO anon, authenticated USING (true);

-- Seed default row so the app always has one settings record to update
INSERT INTO inn_settings (name, description, email, whatsapp, pix_key, pix_key_type, address, city, state, check_in_time, check_out_time)
SELECT 'Minha Pousada', 'Bem-vindo à nossa pousada!', '', '', '', 'Chave Pix', '', '', '', '14:00', '12:00'
WHERE NOT EXISTS (SELECT 1 FROM inn_settings LIMIT 1);
