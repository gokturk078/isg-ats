-- ═══════════════════════════════════════════════════════════════
-- SQL BLOĞU 3: Görev Kategorileri
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE task_categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL UNIQUE,
  color       TEXT DEFAULT '#6366f1',
  icon        TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO task_categories (name, color, icon, sort_order) VALUES
  ('İŞ İZİN SİSTEMİ', '#ef4444', 'file-check', 1),
  ('MAKİNE-EKİPMAN', '#f97316', 'wrench', 2),
  ('EĞİTİM', '#eab308', 'graduation-cap', 3),
  ('TERTİP-DÜZEN-TEMİZLİK', '#22c55e', 'trash-2', 4),
  ('ATİK YÖNETİMİ', '#14b8a6', 'recycle', 5),
  ('KİŞİSEL KORUYUCU DONANIM', '#3b82f6', 'hard-hat', 6),
  ('DEPOLAMA-STOKLAMA', '#8b5cf6', 'package', 7),
  ('İSKELE', '#ec4899', 'layers', 8),
  ('YÜKSEKTE ÇALIŞMA', '#f43f5e', 'arrow-up', 9),
  ('SUPERVİZYON', '#6366f1', 'eye', 10),
  ('ELEKTRİK', '#fbbf24', 'zap', 11),
  ('YANGIN GÜVENLİĞİ', '#dc2626', 'flame', 12);
