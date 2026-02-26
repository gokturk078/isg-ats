-- ═══════════════════════════════════════════════════════════════
-- SQL BLOĞU 6: Fotoğraflar & Ekler
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE task_photos (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  photo_url   TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  photo_type  photo_type DEFAULT 'before',
  caption     TEXT,
  uploaded_by UUID REFERENCES profiles(id),
  file_size   INTEGER,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_task_photos_task_id ON task_photos(task_id);

CREATE TABLE task_attachments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  file_url    TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_name   TEXT NOT NULL,
  file_type   TEXT,
  file_size   INTEGER,
  uploaded_by UUID REFERENCES profiles(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_task_attachments_task_id ON task_attachments(task_id);
