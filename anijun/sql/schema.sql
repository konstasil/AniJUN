-- ==========================================
-- AniJUN — Database Schema for Supabase
-- ==========================================

-- 1. Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Anime (shared catalog)
CREATE TABLE IF NOT EXISTS public.anime (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title TEXT NOT NULL,
  image_url TEXT DEFAULT '',
  genres TEXT[] DEFAULT '{}',
  season_info TEXT DEFAULT 'Зима 2025',
  age_rating TEXT DEFAULT '16+' CHECK (age_rating IN ('0+', '6+', '12+', '16+', '18+', '21+')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.anime ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view anime"
  ON public.anime FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert anime"
  ON public.anime FOR INSERT TO authenticated WITH CHECK (true);

-- 3. Anime Seasons
CREATE TABLE IF NOT EXISTS public.anime_seasons (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  anime_id BIGINT REFERENCES public.anime(id) ON DELETE CASCADE NOT NULL,
  season_number INT NOT NULL,
  episodes_count INT NOT NULL DEFAULT 12,
  UNIQUE(anime_id, season_number)
);

ALTER TABLE public.anime_seasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view seasons"
  ON public.anime_seasons FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert seasons"
  ON public.anime_seasons FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_anime_seasons_anime_id ON public.anime_seasons(anime_id);

-- 4. User Anime List (per-user status)
CREATE TABLE IF NOT EXISTS public.user_anime_list (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  anime_id BIGINT REFERENCES public.anime(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'watching', 'completed')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, anime_id)
);

ALTER TABLE public.user_anime_list ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own list"
  ON public.user_anime_list FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own list"
  ON public.user_anime_list FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_anime_list_user_id ON public.user_anime_list(user_id);

-- 5. Ratings
CREATE TABLE IF NOT EXISTS public.ratings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  anime_id BIGINT REFERENCES public.anime(id) ON DELETE CASCADE NOT NULL,
  rating INT CHECK (rating >= 1 AND rating <= 10),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, anime_id)
);

ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view ratings"
  ON public.ratings FOR SELECT USING (true);

CREATE POLICY "Users can manage own ratings"
  ON public.ratings FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ratings_anime_id ON public.ratings(anime_id);
CREATE INDEX IF NOT EXISTS idx_ratings_user_id ON public.ratings(user_id);

-- 6. Episode Progress (per-user per-season)
CREATE TABLE IF NOT EXISTS public.episode_progress (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  season_id BIGINT REFERENCES public.anime_seasons(id) ON DELETE CASCADE NOT NULL,
  episode_number INT NOT NULL,
  watched BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, season_id, episode_number)
);

ALTER TABLE public.episode_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own progress"
  ON public.episode_progress FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own progress"
  ON public.episode_progress FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_episode_progress_user_season ON public.episode_progress(user_id, season_id);

-- 7. View: weighted rating calculation
CREATE OR REPLACE VIEW public.anime_weighted_ratings AS
SELECT
  a.id AS anime_id,
  a.title,
  COALESCE(
    ROUND(
      (SELECT AVG(r.rating) FROM public.ratings r WHERE r.anime_id = a.id)
      * POWER(
        GREATEST(
          (SELECT COUNT(*) FROM public.ratings r WHERE r.anime_id = a.id)::NUMERIC
          / GREATEST((SELECT COUNT(*) FROM public.profiles)::NUMERIC, 1),
          0
        ),
        0.5
      ),
      2
    ),
    0
  ) AS weighted_rating,
  COALESCE((SELECT COUNT(*) FROM public.ratings r WHERE r.anime_id = a.id), 0) AS votes_count,
  (SELECT COUNT(*) FROM public.profiles) AS total_users
FROM public.anime a;

-- 8. Admins table
CREATE TABLE IF NOT EXISTS public.admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);

INSERT INTO public.admins (user_id) VALUES
  ('8fa96992-b063-4019-83a6-3acac8cc712f'),
  ('cc91e0bb-a24b-41ab-ba41-3bd352ed9add')
ON CONFLICT DO NOTHING;

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view admins"
  ON public.admins FOR SELECT USING (true);

CREATE POLICY "Admins can manage admins"
  ON public.admins FOR ALL
  USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));

-- 9. Admin-only anime insert policy (replace the permissive one)
DROP POLICY IF EXISTS "Authenticated users can insert anime" ON public.anime;
CREATE POLICY "Admins can insert anime"
  ON public.anime FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));

CREATE POLICY "Admins can update anime"
  ON public.anime FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));

CREATE POLICY "Admins can delete anime"
  ON public.anime FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can insert seasons" ON public.anime_seasons;
CREATE POLICY "Admins can manage seasons"
  ON public.anime_seasons FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));

-- 10. Storage buckets (run in Supabase Dashboard > Storage)
-- CREATE BUCKET "users" (public) for user avatars
-- CREATE BUCKET "Anime" (public) for anime posters

-- Storage RLS policies
CREATE POLICY "Avatar upload for own profile"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'users' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Avatar publicly accessible"
  ON storage.objects FOR SELECT USING (bucket_id = 'users');

CREATE POLICY "Anyone can view anime posters"
  ON storage.objects FOR SELECT USING (bucket_id = 'Anime');

CREATE POLICY "Admins can upload anime posters"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'Anime' AND EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));

CREATE POLICY "Admins can update anime posters"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'Anime' AND EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));

CREATE POLICY "Admins can delete anime posters"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'Anime' AND EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));
