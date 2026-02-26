-- ═══════════════════════════════════════════════════════════════
-- SQL BLOĞU 14: RLS Düzeltmesi — profiles SELECT politikası
-- Tüm authenticated kullanıcılar tüm profilleri okuyabilmeli
-- (Task join'lerinde inspector/responsible isimleri görünmesi için)
-- ═══════════════════════════════════════════════════════════════

-- Mevcut kısıtlayıcı SELECT politikalarını kaldır
DROP POLICY IF EXISTS "Herkes kendi profilini görebilir" ON profiles;
DROP POLICY IF EXISTS "Admin tüm profilleri görebilir" ON profiles;

-- Yeni: tüm giriş yapmış kullanıcılar profilleri okuyabilir
CREATE POLICY "Authenticated kullanıcılar profilleri görebilir"
  ON profiles FOR SELECT
  USING (auth.role() = 'authenticated');
