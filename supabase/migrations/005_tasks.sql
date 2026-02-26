-- ═══════════════════════════════════════════════════════════════
-- SQL BLOĞU 5: Görevler (Ana Tablo)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE tasks (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  serial_number       TEXT UNIQUE NOT NULL,
  inspector_id        UUID NOT NULL REFERENCES profiles(id),
  responsible_id      UUID REFERENCES profiles(id),
  location_id         UUID REFERENCES locations(id),
  category_id         UUID REFERENCES task_categories(id),
  floor               TEXT,
  exact_location      TEXT,
  work_type           TEXT,
  detection_method    TEXT DEFAULT 'Saha Gözlem',
  description         TEXT NOT NULL,
  severity            INTEGER NOT NULL CHECK (severity BETWEEN 1 AND 5),
  action_required     TEXT,
  status              task_status DEFAULT 'unassigned',
  due_date            TIMESTAMPTZ,
  rejection_reason    TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  viewed_at           TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  closed_at           TIMESTAMPTZ,
  is_recurring        BOOLEAN DEFAULT FALSE,
  qr_location_id      UUID REFERENCES locations(id)
);

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_inspector_id ON tasks(inspector_id);
CREATE INDEX idx_tasks_responsible_id ON tasks(responsible_id);
CREATE INDEX idx_tasks_location_id ON tasks(location_id);
CREATE INDEX idx_tasks_severity ON tasks(severity);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_created_at ON tasks(created_at);

-- Serial number: YYYYMMDDXXXX
CREATE OR REPLACE FUNCTION generate_serial_number()
RETURNS TRIGGER AS $$
DECLARE
  today_prefix TEXT;
  today_count  INTEGER;
BEGIN
  today_prefix := TO_CHAR(NOW(), 'YYYYMMDD');
  SELECT COUNT(*) + 1 INTO today_count
  FROM tasks
  WHERE serial_number LIKE today_prefix || '%';
  NEW.serial_number := today_prefix || LPAD(today_count::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tasks_serial_number
  BEFORE INSERT ON tasks
  FOR EACH ROW
  WHEN (NEW.serial_number IS NULL OR NEW.serial_number = '')
  EXECUTE FUNCTION generate_serial_number();

-- Due date otomatik hesapla
CREATE OR REPLACE FUNCTION calculate_due_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.due_date IS NULL THEN
    NEW.due_date := CASE NEW.severity
      WHEN 5 THEN NOW() + INTERVAL '4 hours'
      WHEN 4 THEN NOW() + INTERVAL '2 days'
      WHEN 3 THEN NOW() + INTERVAL '7 days'
      WHEN 2 THEN NOW() + INTERVAL '30 days'
      WHEN 1 THEN NOW() + INTERVAL '90 days'
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tasks_due_date
  BEFORE INSERT ON tasks
  FOR EACH ROW EXECUTE FUNCTION calculate_due_date();

-- Responsible atanınca status 'open'
CREATE OR REPLACE FUNCTION update_task_status_on_assign()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.responsible_id IS NOT NULL AND OLD.responsible_id IS NULL THEN
    NEW.status := 'open';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tasks_auto_open
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_task_status_on_assign();
