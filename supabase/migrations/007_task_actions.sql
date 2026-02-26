-- ═══════════════════════════════════════════════════════════════
-- SQL BLOĞU 7: Aksiyon Notları
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE task_actions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id),
  comment     TEXT NOT NULL,
  is_system   BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_task_actions_task_id ON task_actions(task_id);

CREATE OR REPLACE FUNCTION log_task_status_change()
RETURNS TRIGGER AS $$
DECLARE
  status_text TEXT;
BEGIN
  IF OLD.status != NEW.status THEN
    status_text := CASE NEW.status
      WHEN 'open'        THEN '📋 Görev atandı ve açıldı'
      WHEN 'in_progress' THEN '🔄 Görev üzerinde çalışılıyor'
      WHEN 'completed'   THEN '✅ Görev tamamlandı'
      WHEN 'closed'      THEN '🔒 Görev kapatıldı'
      WHEN 'rejected'    THEN '❌ Görev reddedildi'
      ELSE NEW.status::TEXT
    END;

    INSERT INTO task_actions (task_id, user_id, comment, is_system)
    VALUES (
      NEW.id,
      COALESCE(NEW.responsible_id, NEW.inspector_id),
      status_text,
      TRUE
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tasks_log_status
  AFTER UPDATE OF status ON tasks
  FOR EACH ROW EXECUTE FUNCTION log_task_status_change();
