-- ═══════════════════════════════════════════════════════════════
-- SQL BLOĞU 2: Lokasyonlar Tablosu
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE locations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  parent_id   UUID REFERENCES locations(id) ON DELETE SET NULL,
  code        TEXT UNIQUE,
  is_active   BOOLEAN DEFAULT TRUE,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO locations (name, code, sort_order) VALUES
  ('Kargo Terminali', 'CARGO', 1),
  ('Genel', 'GENEL', 2),
  ('T2 ZONE8', 'T2Z8', 3),
  ('T2 ZONE14', 'T2Z14', 4),
  ('Kargo Terminali GAT', 'GAT', 5),
  ('DKE & VİP', 'DKE', 6);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER locations_updated_at
  BEFORE UPDATE ON locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
