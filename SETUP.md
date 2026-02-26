# ISG-ATS Kurulum Rehberi

## 1. Supabase Projesi Oluştur

[Supabase Dashboard](https://app.supabase.com) üzerinden yeni bir proje oluştur.

## 2. SQL Migration'larını Çalıştır

`supabase/migrations/` klasöründeki `.sql` dosyalarını **sırasıyla** Supabase Dashboard > SQL Editor'de çalıştır:

1. `001_extensions_enums.sql` — Extensions ve enum tipleri
2. `002_locations.sql` — Lokasyonlar tablosu + örnek veriler
3. `003_task_categories.sql` — Görev kategorileri + örnek veriler
4. `004_profiles.sql` — Profiller tablosu + auth trigger
5. `005_tasks.sql` — Görevler tablosu + serial number + due date triggers
6. `006_photos_attachments.sql` — Fotoğraflar ve ekler
7. `007_task_actions.sql` — Aksiyon notları + durum değişiklik logu
8. `008_notifications.sql` — Bildirimler
9. `009_email_logs.sql` — Email logları
10. `010_rls.sql` — Row Level Security politikaları
11. `011_storage.sql` — Storage bucket'ları ve politikaları
12. `012_realtime.sql` — Realtime subscription'ları
13. `013_statistics_views.sql` — Dashboard istatistik view'ları

## 3. Database Types Generate Et

```bash
npx supabase gen types typescript --project-id PROJE_ID > src/types/database.types.ts
```

## 4. `.env.local` Dosyasını Doldur

`.env.local.example` dosyasını kopyalayıp gerçek değerleri gir:

```bash
cp .env.local.example .env.local
```

Supabase Dashboard > Settings > API'den URL ve anahtarları al.

## 5. Gmail App Password Oluştur

1. [Google Hesap Güvenliği](https://myaccount.google.com/security) sayfasına git
2. "2 Adımlı Doğrulama" aktifleştir
3. "Uygulama Şifreleri" bölümünden yeni bir şifre oluştur
4. 16 haneli şifreyi `.env.local` dosyasına `GMAIL_APP_PASSWORD` olarak yaz

## 6. İlk Admin Kullanıcısını Oluştur

Supabase Dashboard > Authentication > Users > "Invite User" ile admin emaili davet et.

Ardından Supabase SQL Editor'de çalıştır:

```sql
UPDATE profiles
SET role = 'admin',
    full_name = 'Admin Ad Soyad',
    title = 'Sistem Yöneticisi'
WHERE email = 'admin@sirketiniz.com';
```

## 7. Uygulamayı Başlat

```bash
npm install
npm run dev
```

Uygulama `http://localhost:3000` adresinde çalışacak.

## 8. Vercel'e Deploy Et

```bash
npx vercel --prod
```

Vercel Dashboard'dan environment variable'ları ayarla.
Cron job'lar `vercel.json` dosyasındaki ayarlara göre otomatik çalışacak.
