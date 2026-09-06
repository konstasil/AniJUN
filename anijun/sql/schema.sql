-- ==========================================
-- AniJUN -- Database Schema for Supabase
-- Полностью идемпотентно -- можно запускать сколько угодно раз
-- ==========================================

-- 1. Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,  -- короткий уникальный ID для профиля (не меняется)
  username TEXT UNIQUE NOT NULL,  -- уникальный никнейм (может меняться)
  display_name TEXT,  -- отображаемое имя (может повторяться, может меняться)
  avatar_url TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  background_url TEXT DEFAULT '',
  primary_color TEXT DEFAULT '#38bdf8',
  secondary_color TEXT DEFAULT '#0ea5e9',
  border_radius TEXT DEFAULT '12px',
  display_background BOOLEAN DEFAULT true,
  username_claimed BOOLEAN DEFAULT false,  -- флаг: пользователь уже выбирал свой ник
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, username_claimed)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)), new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'username' IS NOT NULL);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Anime (shared catalog)
CREATE TABLE IF NOT EXISTS public.anime (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug TEXT UNIQUE,
  title TEXT NOT NULL,
  image_url TEXT DEFAULT '',
  genres TEXT[] DEFAULT '{}',
  season_info TEXT DEFAULT 'Зима 2025',
  age_rating TEXT DEFAULT '16+' CHECK (age_rating IN ('0+', '6+', '12+', '16+', '18+', '21+')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Generate slug for existing records if not present
UPDATE public.anime 
SET slug = LOWER(
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      REGEXP_REPLACE(title, '[^a-zA-Zа-яА-Я0-9\s-]', '', 'g'),
      '\s+', '-', 'g'
    ),
    '-+', '-', 'g'
  )
)
WHERE slug IS NULL AND title IS NOT NULL;

-- Remove trailing/leading dashes
UPDATE public.anime
SET slug = TRIM(BOTH '-' FROM slug)
WHERE slug IS NOT NULL AND slug != TRIM(BOTH '-' FROM slug);

ALTER TABLE public.anime ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view anime" ON public.anime;
CREATE POLICY "Anyone can view anime"
  ON public.anime FOR SELECT USING (true);

-- Anime management only by admins
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

-- 3. Anime Seasons
CREATE TABLE IF NOT EXISTS public.anime_seasons (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  anime_id BIGINT REFERENCES public.anime(id) ON DELETE CASCADE NOT NULL,
  season_number INT NOT NULL,
  episodes_count INT NOT NULL DEFAULT 12,
  note TEXT DEFAULT '',
  UNIQUE(anime_id, season_number)
);

ALTER TABLE public.anime_seasons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view seasons" ON public.anime_seasons;
CREATE POLICY "Anyone can view seasons"
  ON public.anime_seasons FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert seasons" ON public.anime_seasons;
DROP POLICY IF EXISTS "Admins can manage seasons" ON public.anime_seasons;

CREATE POLICY "Admins can manage seasons"
  ON public.anime_seasons FOR ALL TO authenticated
  USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_anime_seasons_anime_id ON public.anime_seasons(anime_id);

-- 4. User Anime List (per-user status)
CREATE TABLE IF NOT EXISTS public.user_anime_list (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  anime_id BIGINT REFERENCES public.anime(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'watching', 'completed', 'dropped', 'on_hold')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, anime_id)
);

ALTER TABLE public.user_anime_list ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own list" ON public.user_anime_list;
CREATE POLICY "Users can view own list"
  ON public.user_anime_list FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own list" ON public.user_anime_list;
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

DROP POLICY IF EXISTS "Anyone can view ratings" ON public.ratings;
CREATE POLICY "Anyone can view ratings"
  ON public.ratings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage own ratings" ON public.ratings;
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

DROP POLICY IF EXISTS "Users can view own progress" ON public.episode_progress;
CREATE POLICY "Users can view own progress"
  ON public.episode_progress FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own progress" ON public.episode_progress;
CREATE POLICY "Users can manage own progress"
  ON public.episode_progress FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_episode_progress_user_season ON public.episode_progress(user_id, season_id);

-- 7. View: weighted rating calculation
-- Формула: Рейтинг = Средняя × (Оценившие / Просмотры)^0.5 × e^(-0.000005 × (Просмотры - Оценившие))
-- Просмотры = уникальные пользователи, которые есть в user_anime_list (completed/watching) или в ratings
CREATE OR REPLACE VIEW public.anime_weighted_ratings AS
WITH viewers_count AS (
  SELECT
    anime_id,
    COUNT(DISTINCT user_id) AS viewers
  FROM (
    SELECT anime_id, user_id FROM public.user_anime_list WHERE status IN ('completed', 'watching')
    UNION
    SELECT anime_id, user_id FROM public.ratings
  ) AS combined
  GROUP BY anime_id
),
ratings_agg AS (
  SELECT
    anime_id,
    AVG(rating)::numeric(3,2) AS avg_rating,
    COUNT(*) AS ratings_count
  FROM public.ratings
  GROUP BY anime_id
),
total_users AS (
  SELECT COUNT(*)::numeric AS total FROM public.profiles
)
SELECT
  a.id AS anime_id,
  a.slug,
  a.title,
  a.image_url,
  a.genres,
  a.season_info,
  a.age_rating,
  COALESCE(ra.avg_rating, 0) AS avg_rating,
  COALESCE(ra.ratings_count, 0) AS ratings_count,
  COALESCE(vc.viewers, 0) AS viewers,
  tu.total AS total_users,
  CASE 
    WHEN tu.total > 0 THEN ROUND((COALESCE(ra.ratings_count, 0)::numeric / tu.total) * 100, 2)
    ELSE 0
  END AS rarity_percent
FROM public.anime a
LEFT JOIN ratings_agg ra ON ra.anime_id = a.id
LEFT JOIN viewers_count vc ON vc.anime_id = a.id
CROSS JOIN total_users tu;

-- 8. View: User's Rare Finds (аниме с высокой оценкой пользователя и низкой популярностью на сайте)
-- Редкие находки: аниме с оценкой пользователя 9-10, которое оценило < 5% пользователей сайта
CREATE OR REPLACE VIEW public.user_rare_finds AS
WITH total_users AS (
  SELECT COUNT(*)::numeric AS total FROM public.profiles
),
user_ratings AS (
  SELECT
    r.user_id,
    r.anime_id,
    r.rating AS user_rating,
    a.title,
    a.image_url,
    a.genres,
    a.season_info,
    a.age_rating,
    COALESCE(ra.ratings_count, 0) AS site_ratings_count,
    tu.total AS total_users
  FROM public.ratings r
  JOIN public.anime a ON a.id = r.anime_id
  LEFT JOIN (
    SELECT anime_id, COUNT(*) AS ratings_count FROM public.ratings GROUP BY anime_id
  ) ra ON ra.anime_id = a.id
  CROSS JOIN total_users tu
  WHERE r.rating >= 9
)
SELECT
  user_id,
  anime_id,
  title,
  image_url,
  genres,
  season_info,
  age_rating,
  user_rating,
  site_ratings_count,
  total_users,
  ROUND((site_ratings_count::numeric / total_users) * 100, 2) AS rarity_percent,
  ROUND((1 - (site_ratings_count::numeric / total_users)) * 100, 2) AS rarity_score
FROM user_ratings
WHERE total_users > 0
  AND (site_ratings_count::numeric / total_users) < 0.05  -- менее 5% пользователей сайта оценили
ORDER BY rarity_score DESC, user_rating DESC, site_ratings_count ASC;

-- 9. Admins table -- БЕЗ рекурсии (используем SECURITY DEFINER)
CREATE TABLE IF NOT EXISTS public.admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);

INSERT INTO public.admins (user_id) VALUES
  ('8fa96992-b063-4019-83a6-3acac8cc712f'),
  ('cc91e0bb-a24b-41ab-ba41-3bd352ed9add')
ON CONFLICT DO NOTHING;

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- Security definer function to check admin status without infinite recursion
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

DROP POLICY IF EXISTS "Anyone can view admins" ON public.admins;
CREATE POLICY "Anyone can view admins"
  ON public.admins FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage admins" ON public.admins;
CREATE POLICY "Admins can manage admins"
  ON public.admins FOR ALL
  USING (public.is_admin());

-- 10. Storage buckets (run in Supabase Dashboard > Storage)
-- CREATE BUCKET "users" (public) for user avatars
-- CREATE BUCKET "Anime" (public) for anime posters

-- 11. Storage RLS policies
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

-- 12. Friends table and helper functions
CREATE TABLE IF NOT EXISTS public.friends (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  friend_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, friend_id)
);

ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own friends" ON public.friends;
CREATE POLICY "Users can view own friends"
  ON public.friends FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

DROP POLICY IF EXISTS "Users can send friend requests" ON public.friends;
CREATE POLICY "Users can send friend requests"
  ON public.friends FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own friendships" ON public.friends;
CREATE POLICY "Users can update own friendships"
  ON public.friends FOR UPDATE
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

DROP POLICY IF EXISTS "Users can delete own friendships" ON public.friends;
CREATE POLICY "Users can delete own friendships"
  ON public.friends FOR DELETE
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE INDEX IF NOT EXISTS idx_friends_user_id ON public.friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend_id ON public.friends(friend_id);
CREATE INDEX IF NOT EXISTS idx_friends_status ON public.friends(status);

CREATE OR REPLACE FUNCTION public.are_friends(user1 UUID, user2 UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friends
    WHERE ((user_id = user1 AND friend_id = user2) OR (user_id = user2 AND friend_id = user1))
      AND status = 'accepted'
  );
$$;

CREATE OR REPLACE FUNCTION public.get_friends(target_user UUID)
RETURNS TABLE (friend_id UUID, username TEXT, avatar_url TEXT)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT 
    CASE WHEN f.user_id = target_user THEN f.friend_id ELSE f.user_id END AS friend_id,
    p.username,
    p.avatar_url
  FROM public.friends f
  JOIN public.profiles p ON p.id = CASE WHEN f.user_id = target_user THEN f.friend_id ELSE f.user_id END
  WHERE (f.user_id = target_user OR f.friend_id = target_user)
    AND f.status = 'accepted'
  ORDER BY p.username;
$$;

CREATE OR REPLACE FUNCTION public.get_pending_requests(target_user UUID)
RETURNS TABLE (request_id BIGINT, user_id UUID, username TEXT, avatar_url TEXT)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT 
    f.id AS request_id,
    f.user_id,
    p.username,
    p.avatar_url
  FROM public.friends f
  JOIN public.profiles p ON p.id = f.user_id
  WHERE f.friend_id = target_user
    AND f.status = 'pending'
  ORDER BY f.created_at DESC;
$$;

-- 13. Admin simulations table
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