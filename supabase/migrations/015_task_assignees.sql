-- ═══════════════════════════════════════════════════════════════
-- SQL BLOĞU 15: Çoklu Görevli Atama
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS task_assignees (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id      UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_by  UUID REFERENCES profiles(id),
  is_primary   BOOLEAN DEFAULT FALSE,
  assigned_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_task_assignees_task_id ON task_assignees(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_user_id ON task_assignees(user_id);

-- Mevcut tekli atamaları çoklu atama tablosuna taşı.
INSERT INTO task_assignees (task_id, user_id, assigned_by, is_primary)
SELECT id, responsible_id, inspector_id, TRUE
FROM tasks
WHERE responsible_id IS NOT NULL
ON CONFLICT (task_id, user_id) DO UPDATE SET is_primary = TRUE;

ALTER TABLE task_assignees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated task assignees okuyabilir"
  ON task_assignees FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Denetçi ve admin görevli ataması yapabilir"
  ON task_assignees FOR INSERT
  WITH CHECK (get_my_role() IN ('inspector', 'admin'));

CREATE POLICY "Denetçi ve admin görevli ataması silebilir"
  ON task_assignees FOR DELETE
  USING (get_my_role() IN ('inspector', 'admin'));

CREATE POLICY "Denetçi ve admin görevli ataması güncelleyebilir"
  ON task_assignees FOR UPDATE
  USING (get_my_role() IN ('inspector', 'admin'))
  WITH CHECK (get_my_role() IN ('inspector', 'admin'));

-- Çoklu atanan görevliler görevleri görebilmeli ve aksiyon alabilmeli.
CREATE POLICY "Görevli çoklu atandığı görevleri görebilir"
  ON tasks FOR SELECT USING (
    get_my_role() = 'responsible'
    AND EXISTS (
      SELECT 1
      FROM task_assignees
      WHERE task_assignees.task_id = tasks.id
        AND task_assignees.user_id = auth.uid()
    )
  );

CREATE POLICY "Görevli çoklu atandığı görevi güncelleyebilir"
  ON tasks FOR UPDATE USING (
    get_my_role() = 'responsible'
    AND EXISTS (
      SELECT 1
      FROM task_assignees
      WHERE task_assignees.task_id = tasks.id
        AND task_assignees.user_id = auth.uid()
    )
  );
