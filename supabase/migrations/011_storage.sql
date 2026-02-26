-- ═══════════════════════════════════════════════════════════════
-- SQL BLOĞU 11: Supabase Storage Buckets
-- ═══════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'task-photos',
    'task-photos',
    TRUE,
    10485760,
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic']
  ),
  (
    'task-attachments',
    'task-attachments',
    FALSE,
    52428800,
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  );

CREATE POLICY "Kimlik doğrulanmış kullanıcılar fotoğraf yükleyebilir"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'task-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Herkese açık fotoğraf okuma"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'task-photos');

CREATE POLICY "Kendi yüklediğini silebilir"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'task-photos' AND auth.uid() = owner);
