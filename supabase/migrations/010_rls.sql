-- ═══════════════════════════════════════════════════════════════
-- SQL BLOĞU 10: Row Level Security (RLS)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_photos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_actions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications   ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs      ENABLE ROW LEVEL SECURITY;

-- Helper function
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ═══ PROFILES ═══
CREATE POLICY "Herkes kendi profilini görebilir"
  ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admin tüm profilleri görebilir"
  ON profiles FOR SELECT USING (get_my_role() = 'admin');

CREATE POLICY "Kendi profilini güncelleyebilir"
  ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admin tüm profilleri güncelleyebilir"
  ON profiles FOR UPDATE USING (get_my_role() = 'admin');

-- ═══ LOCATIONS ═══
CREATE POLICY "Herkes lokasyonları görebilir"
  ON locations FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Sadece admin lokasyon yönetebilir"
  ON locations FOR ALL USING (get_my_role() = 'admin');

-- ═══ TASK_CATEGORIES ═══
CREATE POLICY "Herkes kategorileri görebilir"
  ON task_categories FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Sadece admin kategori yönetebilir"
  ON task_categories FOR ALL USING (get_my_role() = 'admin');

-- ═══ TASKS ═══
CREATE POLICY "Admin tüm görevleri görebilir"
  ON tasks FOR SELECT USING (get_my_role() = 'admin');

CREATE POLICY "Denetçi kendi görevlerini görebilir"
  ON tasks FOR SELECT USING (
    get_my_role() = 'inspector' AND inspector_id = auth.uid()
  );

CREATE POLICY "Görevli atandığı görevleri görebilir"
  ON tasks FOR SELECT USING (
    get_my_role() = 'responsible' AND responsible_id = auth.uid()
  );

CREATE POLICY "Denetçi görev oluşturabilir"
  ON tasks FOR INSERT WITH CHECK (
    get_my_role() IN ('inspector', 'admin')
  );

CREATE POLICY "Admin tüm görevleri güncelleyebilir"
  ON tasks FOR UPDATE USING (get_my_role() = 'admin');

CREATE POLICY "Denetçi kendi görevini güncelleyebilir"
  ON tasks FOR UPDATE USING (
    get_my_role() = 'inspector' AND inspector_id = auth.uid()
  );

CREATE POLICY "Görevli atandığı görevi güncelleyebilir"
  ON tasks FOR UPDATE USING (
    get_my_role() = 'responsible' AND responsible_id = auth.uid()
  );

-- ═══ TASK_PHOTOS ═══
CREATE POLICY "Görev görebilenlerin fotoğrafı da görür"
  ON task_photos FOR SELECT USING (
    EXISTS (SELECT 1 FROM tasks WHERE id = task_id)
  );

CREATE POLICY "Yetkili kullanıcı fotoğraf yükleyebilir"
  ON task_photos FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ═══ TASK_ATTACHMENTS ═══
CREATE POLICY "Görev görebilenlerin ekleri de görür"
  ON task_attachments FOR SELECT USING (
    EXISTS (SELECT 1 FROM tasks WHERE id = task_id)
  );

CREATE POLICY "Yetkili kullanıcı ek yükleyebilir"
  ON task_attachments FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ═══ TASK_ACTIONS ═══
CREATE POLICY "Görevi görenler aksiyon notlarını görür"
  ON task_actions FOR SELECT USING (
    EXISTS (SELECT 1 FROM tasks WHERE id = task_id)
  );

CREATE POLICY "Yetkili kullanıcı not ekleyebilir"
  ON task_actions FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ═══ NOTIFICATIONS ═══
CREATE POLICY "Sadece kendi bildirimleri"
  ON notifications FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Kendi bildirimlerini okuyabilir"
  ON notifications FOR UPDATE USING (user_id = auth.uid());

-- ═══ EMAIL_LOGS ═══
CREATE POLICY "Sadece admin email loglarını görebilir"
  ON email_logs FOR SELECT USING (get_my_role() = 'admin');
