-- ==========================================
-- AniJUN -- Таблица предложений аниме от пользователей
-- ==========================================
CREATE TABLE IF NOT EXISTS public.anime_suggestions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  genres TEXT[] DEFAULT '{}',
  season_info TEXT DEFAULT '',
  age_rating TEXT DEFAULT '16+',
  image_url TEXT DEFAULT '',
  comment TEXT DEFAULT '',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.anime_suggestions ENABLE ROW LEVEL SECURITY;

-- Все могут читать только свои предложения
DROP POLICY IF EXISTS "Users can view own suggestions" ON public.anime_suggestions;
CREATE POLICY "Users can view own suggestions"
  ON public.anime_suggestions FOR SELECT
  USING (auth.uid() = user_id);

-- Аутентифицированные пользователи могут создавать предложения
DROP POLICY IF EXISTS "Authenticated users can insert suggestions" ON public.anime_suggestions;
CREATE POLICY "Authenticated users can insert suggestions"
  ON public.anime_suggestions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Админы могут читать все предложения
DROP POLICY IF EXISTS "Admins can view all suggestions" ON public.anime_suggestions;
CREATE POLICY "Admins can view all suggestions"
  ON public.anime_suggestions FOR SELECT
  USING (public.is_admin());

-- Админы могут обновлять статус предложений
DROP POLICY IF EXISTS "Admins can update suggestions" ON public.anime_suggestions;
CREATE POLICY "Admins can update suggestions"
  ON public.anime_suggestions FOR UPDATE TO authenticated
  USING (public.is_admin());