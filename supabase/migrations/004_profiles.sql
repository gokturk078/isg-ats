-- ═══════════════════════════════════════════════════════════════
-- SQL BLOĞU 4: Profiller (Kullanıcılar)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  phone       TEXT,
  role        user_role NOT NULL DEFAULT 'responsible',
  company     TEXT,
  title       TEXT,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  avatar_url  TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  last_seen   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'İsimsiz Kullanıcı'),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'responsible')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
