-- ============================================================
-- AniJUN -- Unified Migration for Existing Databases
-- Run this ONCE on existing DB to add all new features
-- ============================================================

-- 1. Add new columns to profiles (user_id, display_name, customization fields)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS user_id BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
ADD COLUMN IF NOT EXISTS display_name TEXT,
ADD COLUMN IF NOT EXISTS username_claimed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS background_url TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#38bdf8',
ADD COLUMN IF NOT EXISTS secondary_color TEXT DEFAULT '#0ea5e9',
ADD COLUMN IF NOT EXISTS border_radius TEXT DEFAULT '12px',
ADD COLUMN IF NOT EXISTS display_background BOOLEAN DEFAULT true;

-- 2. Backfill user_id for existing profiles (if any have NULL)
-- The GENERATED ALWAYS AS IDENTITY will auto-assign on new rows,
-- but existing rows need explicit update. This handles it:
DO $$
BEGIN
  -- user_id is GENERATED ALWAYS AS IDENTITY, so it auto-fills on INSERT
  -- No action needed for existing rows if column was added with that type
  -- But if added without GENERATED, uncomment below:
  -- UPDATE public.profiles SET user_id = nextval(pg_get_serial_sequence('profiles', 'user_id')) WHERE user_id IS NULL;
END $$;

-- 3. Update trigger to set username_claimed correctly
-- For email/password signup with username: username_claimed = true
-- For Google OAuth without username: username_claimed = false
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, username_claimed)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)), 
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'username' IS NOT NULL
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Admin-only RLS for anime (remove old broad policies)
DROP POLICY IF EXISTS "Authenticated users can insert anime" ON public.anime;
DROP POLICY IF EXISTS "Admins can insert anime" ON public.anime;
DROP POLICY IF EXISTS "Admins can update anime" ON public.anime;
DROP POLICY IF EXISTS "Admins can delete anime" ON public.anime;

CREATE POLICY "Admins can insert anime"
  ON public.anime FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update anime"
  ON public.anime FOR UPDATE TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can delete anime"
  ON public.anime FOR DELETE TO authenticated
  USING (public.is_admin());

-- 5. Admin-only RLS for anime_seasons (fixes season delete bug)
DROP POLICY IF EXISTS "Authenticated users can insert seasons" ON public.anime_seasons;
DROP POLICY IF EXISTS "Admins can update seasons" ON public.anime_seasons;
DROP POLICY IF EXISTS "Admins can delete seasons" ON public.anime_seasons;
DROP POLICY IF EXISTS "Admins can manage seasons" ON public.anime_seasons;

CREATE POLICY "Admins can manage seasons"
  ON public.anime_seasons FOR ALL TO authenticated
  USING (public.is_admin());

-- 6. Storage RLS policies (avatars + anime posters)
-- Avatars: users can only manage their own folder (users/<uid>/)
DROP POLICY IF EXISTS "Avatar upload for own profile" ON storage.objects;
CREATE POLICY "Avatar upload for own profile"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'users' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Avatar publicly accessible" ON storage.objects;
CREATE POLICY "Avatar publicly accessible"
  ON storage.objects FOR SELECT USING (bucket_id = 'users');

DROP POLICY IF EXISTS "Avatar update for own profile" ON storage.objects;
CREATE POLICY "Avatar update for own profile"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'users' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'users' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Avatar delete for own profile" ON storage.objects;
CREATE POLICY "Avatar delete for own profile"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'users' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Anime posters: public read, admin write
DROP POLICY IF EXISTS "Anyone can view anime posters" ON storage.objects;
CREATE POLICY "Anyone can view anime posters"
  ON storage.objects FOR SELECT USING (bucket_id = 'Anime');

DROP POLICY IF EXISTS "Admins can upload anime posters" ON storage.objects;
CREATE POLICY "Admins can upload anime posters"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'Anime' AND public.is_admin());

DROP POLICY IF EXISTS "Admins can update anime posters" ON storage.objects;
CREATE POLICY "Admins can update anime posters"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'Anime' AND public.is_admin());

DROP POLICY IF EXISTS "Admins can delete anime posters" ON storage.objects;
CREATE POLICY "Admins can delete anime posters"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'Anime' AND public.is_admin());

-- 7. Ensure admin users exist (idempotent)
INSERT INTO public.admins (user_id) VALUES
  ('8fa96992-b063-4019-83a6-3acac8cc712f'),
  ('cc91e0bb-a24b-41ab-ba41-3bd352ed9add')
ON CONFLICT DO NOTHING;

-- 8. Ensure is_admin() function exists (required for RLS above)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admins WHERE user_id = auth.uid()
  );
$$;

-- 9. Ensure admin_simulations table exists (for admin user switching)
CREATE TABLE IF NOT EXISTS public.admin_simulations (
  admin_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  simulated_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (admin_id)
);

ALTER TABLE public.admin_simulations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage simulations" ON public.admin_simulations;
CREATE POLICY "Admins can manage simulations"
  ON public.admin_simulations FOR ALL
  USING (public.is_admin());