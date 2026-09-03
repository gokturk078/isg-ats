-- ═══════════════════════════════════════════════════════════════
-- SQL BLOĞU 15: Kullanıcı ve Storage stabilizasyonu
--
-- Amaçlar:
--   1. auth.users -> public.profiles oluşturma akışını güvenilir yapmak
--   2. Mevcut eksik profilleri en düşük yetkiyle tamamlamak
--   3. Pasif kullanıcıların veri erişimini RLS seviyesinde durdurmak
--   4. Hassas profil alanlarında yetki yükseltmeyi engellemek
--   5. Görev fotoğrafı ve private ek dosya Storage erişimini düzeltmek
--
-- Bu migration veri silmez. Yeniden çalıştırılabilir (idempotent) olacak
-- şekilde hazırlanmıştır.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- Canlı sistemde beklenmeyen uzun kilitler oluşturmadan güvenli biçimde
-- başarısız ol; hata halinde transaction tamamıyla geri alınır.
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- ───────────────────────────────────────────────────────────────
-- 1. Profil şemasını uygulamanın kullandığı alanlarla eşitle
-- ───────────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN;

UPDATE public.profiles
SET
  is_active = COALESCE(is_active, TRUE),
  is_super_admin = COALESCE(is_super_admin, FALSE),
  must_change_password = COALESCE(must_change_password, FALSE)
WHERE
  is_active IS NULL
  OR is_super_admin IS NULL
  OR must_change_password IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN is_active SET DEFAULT TRUE,
  ALTER COLUMN is_active SET NOT NULL,
  ALTER COLUMN is_super_admin SET DEFAULT FALSE,
  ALTER COLUMN is_super_admin SET NOT NULL,
  ALTER COLUMN must_change_password SET DEFAULT FALSE,
  ALTER COLUMN must_change_password SET NOT NULL;

-- Private bucket dosyalarında süresi dolan public/signed URL saklanmayacak.
-- İndirme URL'si gerektiği anda üretilecektir.
ALTER TABLE public.task_attachments
  ALTER COLUMN file_url DROP NOT NULL;

-- ───────────────────────────────────────────────────────────────
-- 2. Yeni Auth kullanıcıları için güvenli profil trigger'ı
-- ───────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  requested_role public.user_role := 'responsible'::public.user_role;
BEGIN
  -- Rol yalnızca service-role tarafından yazılabilen app_metadata'dan
  -- okunur. Kullanıcının değiştirebildiği raw_user_meta_data rol için
  -- kesinlikle kullanılmaz.
  IF COALESCE(NEW.raw_app_meta_data ->> 'app_role', '') IN
     ('admin', 'inspector', 'responsible') THEN
    requested_role := (NEW.raw_app_meta_data ->> 'app_role')::public.user_role;
  END IF;

  INSERT INTO public.profiles (
    id,
    full_name,
    email,
    role,
    is_active,
    is_super_admin,
    must_change_password
  )
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'full_name'), ''),
      NULLIF(SPLIT_PART(COALESCE(NEW.email, ''), '@', 1), ''),
      'Kullanıcı'
    ),
    COALESCE(NEW.email, NEW.id::TEXT || '@auth.local'),
    requested_role,
    TRUE,
    FALSE,
    TRUE
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Auth tarafında var olup profile tarafında olmayan hesapları tamamla.
-- Yetki yükseltme riskini önlemek için bu kayıtlar her zaman responsible
-- rolüyle oluşturulur. Aynı email başka bir profile bağlıysa kayıt atlanır
-- ve dosyanın sonundaki doğrulama çıktısında raporlanır.
INSERT INTO public.profiles (
  id,
  full_name,
  email,
  role,
  is_active,
  is_super_admin,
  must_change_password
)
SELECT
  auth_user.id,
  COALESCE(
    NULLIF(BTRIM(auth_user.raw_user_meta_data ->> 'full_name'), ''),
    NULLIF(SPLIT_PART(COALESCE(auth_user.email, ''), '@', 1), ''),
    'Kullanıcı'
  ),
  COALESCE(auth_user.email, auth_user.id::TEXT || '@auth.local'),
  'responsible'::public.user_role,
  TRUE,
  FALSE,
  FALSE
FROM auth.users AS auth_user
WHERE NOT EXISTS (
  SELECT 1
  FROM public.profiles AS profile_by_id
  WHERE profile_by_id.id = auth_user.id
)
AND NOT EXISTS (
  SELECT 1
  FROM public.profiles AS profile_by_email
  WHERE LOWER(profile_by_email.email) = LOWER(
    COALESCE(auth_user.email, auth_user.id::TEXT || '@auth.local')
  )
)
ON CONFLICT DO NOTHING;

-- ───────────────────────────────────────────────────────────────
-- 3. Aktif kullanıcı ve rol helper'ları
-- ───────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_current_user_active()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND is_active IS TRUE
  );
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.user_role
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT role
  FROM public.profiles
  WHERE id = (SELECT auth.uid())
    AND is_active IS TRUE
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.is_current_user_active() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_role() FROM PUBLIC;
-- Mevcut bazı task politikaları TO rolü belirtmeden oluşturulduğu için anon
-- çağrılar da helper'ı değerlendirebilir. Helper anon için yalnızca false/NULL
-- döndürür; EXECUTE izni verilmesi veri erişimi sağlamaz, permission error yerine
-- güvenli şekilde sıfır satır dönmesini sağlar.
GRANT EXECUTE ON FUNCTION public.is_current_user_active() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO anon, authenticated, service_role;

-- ───────────────────────────────────────────────────────────────
-- 4. Hassas profil alanlarını DB seviyesinde koru
-- ───────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.guard_profile_sensitive_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_is_super_admin BOOLEAN := FALSE;
  caller_is_trusted_server BOOLEAN := FALSE;
BEGIN
  IF OLD.role IS NOT DISTINCT FROM NEW.role
     AND OLD.is_active IS NOT DISTINCT FROM NEW.is_active
     AND OLD.is_super_admin IS NOT DISTINCT FROM NEW.is_super_admin
     AND OLD.must_change_password IS NOT DISTINCT FROM NEW.must_change_password THEN
    RETURN NEW;
  END IF;

  caller_is_trusted_server :=
    COALESCE(auth.role(), '') = 'service_role'
    OR session_user IN ('postgres', 'supabase_admin');

  IF NOT caller_is_trusted_server THEN
    SELECT COALESCE(profile.is_super_admin, FALSE)
    INTO caller_is_super_admin
    FROM public.profiles AS profile
    WHERE profile.id = (SELECT auth.uid())
      AND profile.is_active IS TRUE;
  END IF;

  IF caller_is_trusted_server OR caller_is_super_admin THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'role, is_active, is_super_admin ve must_change_password alanlarını değiştirme yetkiniz yok'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_sensitive_fields ON public.profiles;

CREATE TRIGGER profiles_guard_sensitive_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_sensitive_fields();

REVOKE ALL ON FUNCTION public.guard_profile_sensitive_fields() FROM PUBLIC;

-- ───────────────────────────────────────────────────────────────
-- 5. Profil ve temel referans verisi RLS politikaları
-- ───────────────────────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Herkes kendi profilini görebilir" ON public.profiles;
DROP POLICY IF EXISTS "Admin tüm profilleri görebilir" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated kullanıcılar profilleri görebilir" ON public.profiles;
DROP POLICY IF EXISTS "Kullanıcılar gerekli profilleri görebilir" ON public.profiles;

CREATE POLICY "Kullanıcılar gerekli profilleri görebilir"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR (SELECT public.is_current_user_active())
  );

DROP POLICY IF EXISTS "Kendi profilini güncelleyebilir" ON public.profiles;

CREATE POLICY "Kendi profilini güncelleyebilir"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    id = (SELECT auth.uid())
    AND (SELECT public.is_current_user_active())
  )
  WITH CHECK (
    id = (SELECT auth.uid())
    AND (SELECT public.is_current_user_active())
  );

DROP POLICY IF EXISTS "Admin tüm profilleri güncelleyebilir" ON public.profiles;

CREATE POLICY "Admin tüm profilleri güncelleyebilir"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING ((SELECT public.get_my_role()) = 'admin'::public.user_role)
  WITH CHECK ((SELECT public.get_my_role()) = 'admin'::public.user_role);

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Herkes lokasyonları görebilir" ON public.locations;

CREATE POLICY "Herkes lokasyonları görebilir"
  ON public.locations
  FOR SELECT
  TO authenticated
  USING ((SELECT public.is_current_user_active()));

ALTER TABLE public.task_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Herkes kategorileri görebilir" ON public.task_categories;

CREATE POLICY "Herkes kategorileri görebilir"
  ON public.task_categories
  FOR SELECT
  TO authenticated
  USING ((SELECT public.is_current_user_active()));

-- Tasks politikaları zaten get_my_role() kullandığı için helper'ın aktiflik
-- kontrolü, mevcut rol/yetki davranışını değiştirmeden pasif hesapları durdurur.

-- ───────────────────────────────────────────────────────────────
-- 6. Görev fotoğrafı ve ek dosya metadata RLS politikaları
-- ───────────────────────────────────────────────────────────────

ALTER TABLE public.task_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Yetkili kullanıcı fotoğraf yükleyebilir" ON public.task_photos;

CREATE POLICY "Yetkili kullanıcı fotoğraf yükleyebilir"
  ON public.task_photos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT public.is_current_user_active())
    AND uploaded_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.tasks
      WHERE id = task_id
    )
  );

DROP POLICY IF EXISTS "Yetkili kullanıcı fotoğraf silebilir" ON public.task_photos;

CREATE POLICY "Yetkili kullanıcı fotoğraf silebilir"
  ON public.task_photos
  FOR DELETE
  TO authenticated
  USING (
    (SELECT public.is_current_user_active())
    AND (
      uploaded_by = (SELECT auth.uid())
      OR (SELECT public.get_my_role()) = 'admin'::public.user_role
    )
  );

ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Yetkili kullanıcı ek yükleyebilir" ON public.task_attachments;

CREATE POLICY "Yetkili kullanıcı ek yükleyebilir"
  ON public.task_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT public.is_current_user_active())
    AND uploaded_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.tasks
      WHERE id = task_id
    )
  );

DROP POLICY IF EXISTS "Yetkili kullanıcı ek silebilir" ON public.task_attachments;

CREATE POLICY "Yetkili kullanıcı ek silebilir"
  ON public.task_attachments
  FOR DELETE
  TO authenticated
  USING (
    (SELECT public.is_current_user_active())
    AND (
      uploaded_by = (SELECT auth.uid())
      OR (SELECT public.get_my_role()) = 'admin'::public.user_role
    )
  );

-- Pasif hesapların not eklemesini engelle; mevcut görev/rol davranışı korunur.
ALTER TABLE public.task_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Yetkili kullanıcı not ekleyebilir" ON public.task_actions;

CREATE POLICY "Yetkili kullanıcı not ekleyebilir"
  ON public.task_actions
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.is_current_user_active()));

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Sadece kendi bildirimleri" ON public.notifications;

CREATE POLICY "Sadece kendi bildirimleri"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND (SELECT public.is_current_user_active())
  );

DROP POLICY IF EXISTS "Kendi bildirimlerini okuyabilir" ON public.notifications;

CREATE POLICY "Kendi bildirimlerini okuyabilir"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND (SELECT public.is_current_user_active())
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND (SELECT public.is_current_user_active())
  );

-- ───────────────────────────────────────────────────────────────
-- 7. Storage bucket ayarları ve nesne politikaları
-- ───────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES
  (
    'task-photos',
    'task-photos',
    TRUE,
    10485760,
    ARRAY[
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
      'image/gif'
    ]::TEXT[]
  ),
  (
    'task-attachments',
    'task-attachments',
    FALSE,
    52428800,
    ARRAY[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
      'image/gif'
    ]::TEXT[]
  )
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Eski ve bu migration'a ait policy adlarını temizleyip aynı kurallarla
-- yeniden oluştur. Başka isimli özel müşteri politikalarına dokunulmaz.
DROP POLICY IF EXISTS "Kimlik doğrulanmış kullanıcılar fotoğraf yükleyebilir" ON storage.objects;
DROP POLICY IF EXISTS "Herkese açık fotoğraf okuma" ON storage.objects;
DROP POLICY IF EXISTS "Kendi yüklediğini silebilir" ON storage.objects;
DROP POLICY IF EXISTS "Görev fotoğrafları yüklenebilir" ON storage.objects;
DROP POLICY IF EXISTS "Görev fotoğrafları güncellenebilir" ON storage.objects;
DROP POLICY IF EXISTS "Görev fotoğrafları silinebilir" ON storage.objects;
DROP POLICY IF EXISTS "Görev fotoğrafları herkese açık" ON storage.objects;
DROP POLICY IF EXISTS "Görev ekleri okunabilir" ON storage.objects;
DROP POLICY IF EXISTS "Görev ekleri yüklenebilir" ON storage.objects;
DROP POLICY IF EXISTS "Görev ekleri güncellenebilir" ON storage.objects;
DROP POLICY IF EXISTS "Görev ekleri silinebilir" ON storage.objects;

CREATE POLICY "Görev fotoğrafları herkese açık"
  ON storage.objects
  FOR SELECT
  TO PUBLIC
  USING (bucket_id = 'task-photos');

CREATE POLICY "Görev fotoğrafları yüklenebilir"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'task-photos'
    AND (SELECT public.is_current_user_active())
    AND EXISTS (
      SELECT 1
      FROM public.tasks
      WHERE id::TEXT = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "Görev fotoğrafları güncellenebilir"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'task-photos'
    AND (SELECT public.is_current_user_active())
    AND (
      owner_id = (SELECT auth.uid())::TEXT
      OR (SELECT public.get_my_role()) = 'admin'::public.user_role
    )
  )
  WITH CHECK (
    bucket_id = 'task-photos'
    AND (SELECT public.is_current_user_active())
  );

CREATE POLICY "Görev fotoğrafları silinebilir"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'task-photos'
    AND (SELECT public.is_current_user_active())
    AND (
      owner_id = (SELECT auth.uid())::TEXT
      OR (SELECT public.get_my_role()) = 'admin'::public.user_role
    )
  );

CREATE POLICY "Görev ekleri okunabilir"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'task-attachments'
    AND (SELECT public.is_current_user_active())
    AND EXISTS (
      SELECT 1
      FROM public.tasks
      WHERE id::TEXT = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "Görev ekleri yüklenebilir"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'task-attachments'
    AND (SELECT public.is_current_user_active())
    AND EXISTS (
      SELECT 1
      FROM public.tasks
      WHERE id::TEXT = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "Görev ekleri güncellenebilir"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'task-attachments'
    AND (SELECT public.is_current_user_active())
    AND (
      owner_id = (SELECT auth.uid())::TEXT
      OR (SELECT public.get_my_role()) = 'admin'::public.user_role
    )
  )
  WITH CHECK (
    bucket_id = 'task-attachments'
    AND (SELECT public.is_current_user_active())
  );

CREATE POLICY "Görev ekleri silinebilir"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'task-attachments'
    AND (SELECT public.is_current_user_active())
    AND (
      owner_id = (SELECT auth.uid())::TEXT
      OR (SELECT public.get_my_role()) = 'admin'::public.user_role
    )
  );

COMMIT;

-- ═══════════════════════════════════════════════════════════════
-- DOĞRULAMA
-- Supabase SQL Editor'da migration tamamlandığında aşağıdaki tek JSON
-- sonucunu kopyalayıp geliştirme ekibine gönderin.
-- ═══════════════════════════════════════════════════════════════

SELECT JSONB_BUILD_OBJECT(
  'migration', '015_user_storage_stability',
  'status', CASE
    WHEN
      EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'on_auth_user_created'
          AND tgrelid = 'auth.users'::REGCLASS
          AND NOT tgisinternal
          AND tgenabled <> 'D'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM auth.users AS auth_user
        WHERE NOT EXISTS (
          SELECT 1
          FROM public.profiles AS profile
          WHERE profile.id = auth_user.id
        )
      )
      AND EXISTS (
        SELECT 1
        FROM storage.buckets
        WHERE id = 'task-photos'
          AND public IS TRUE
          AND file_size_limit = 10485760
      )
      AND EXISTS (
        SELECT 1
        FROM storage.buckets
        WHERE id = 'task-attachments'
          AND public IS FALSE
          AND file_size_limit = 52428800
      )
      AND (
        SELECT COUNT(*)
        FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname IN (
            'Görev fotoğrafları herkese açık',
            'Görev fotoğrafları yüklenebilir',
            'Görev fotoğrafları güncellenebilir',
            'Görev fotoğrafları silinebilir',
            'Görev ekleri okunabilir',
            'Görev ekleri yüklenebilir',
            'Görev ekleri güncellenebilir',
            'Görev ekleri silinebilir'
          )
      ) = 8
    THEN 'ok'
    ELSE 'attention_required'
  END,
  'profile_trigger_active', EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'on_auth_user_created'
      AND tgrelid = 'auth.users'::REGCLASS
      AND NOT tgisinternal
      AND tgenabled <> 'D'
  ),
  'orphan_auth_users', (
    SELECT COUNT(*)
    FROM auth.users AS auth_user
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.profiles AS profile
      WHERE profile.id = auth_user.id
    )
  ),
  'orphan_email_conflicts', (
    SELECT COUNT(*)
    FROM auth.users AS auth_user
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.profiles AS profile_by_id
      WHERE profile_by_id.id = auth_user.id
    )
    AND EXISTS (
      SELECT 1
      FROM public.profiles AS profile_by_email
      WHERE LOWER(profile_by_email.email) = LOWER(
        COALESCE(auth_user.email, auth_user.id::TEXT || '@auth.local')
      )
    )
  ),
  'profile_columns_ready', (
    SELECT COUNT(*) = 2
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name IN ('is_super_admin', 'must_change_password')
  ),
  'task_photos_bucket_ready', EXISTS (
    SELECT 1
    FROM storage.buckets
    WHERE id = 'task-photos'
      AND public IS TRUE
      AND file_size_limit = 10485760
  ),
  'task_attachments_bucket_ready', EXISTS (
    SELECT 1
    FROM storage.buckets
    WHERE id = 'task-attachments'
      AND public IS FALSE
      AND file_size_limit = 52428800
  ),
  'storage_policy_count', (
    SELECT COUNT(*)
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname IN (
        'Görev fotoğrafları herkese açık',
        'Görev fotoğrafları yüklenebilir',
        'Görev fotoğrafları güncellenebilir',
        'Görev fotoğrafları silinebilir',
        'Görev ekleri okunabilir',
        'Görev ekleri yüklenebilir',
        'Görev ekleri güncellenebilir',
        'Görev ekleri silinebilir'
      )
  ),
  'sensitive_profile_guard_active', EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'profiles_guard_sensitive_fields'
      AND tgrelid = 'public.profiles'::REGCLASS
      AND NOT tgisinternal
      AND tgenabled <> 'D'
  )
) AS migration_verification;
