-- ==========================================
-- AniJUN -- Миграция для рекомендательного движка
-- ==========================================

-- 1. Таблица для кеширования похожести пользователей (Версия 2)
-- Это ускорит работу коллаборативной фильтрации при большом количестве пользователей
CREATE TABLE IF NOT EXISTS public.user_similarity (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id_a UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  user_id_b UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  similarity NUMERIC(6,4) NOT NULL DEFAULT 0,
  calculated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id_a, user_id_b)
);

ALTER TABLE public.user_similarity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view similarity" ON public.user_similarity;
CREATE POLICY "Anyone can view similarity"
  ON public.user_similarity FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role can manage similarity" ON public.user_similarity;
CREATE POLICY "Service role can manage similarity"
  ON public.user_similarity FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_user_similarity_a ON public.user_similarity(user_id_a);
CREATE INDEX IF NOT EXISTS idx_user_similarity_b ON public.user_similarity(user_id_b);

-- 2. Функция для подсчёта количества пользователей с оценками
-- Используется в рекомендательном движке для выбора версии
CREATE OR REPLACE FUNCTION public.count_users_with_ratings()
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COUNT(DISTINCT user_id) FROM public.ratings;
$$;

-- 3. Функция для получения среднего взвешенного рейтинга аниме
-- (уже есть в виде anime_weighted_ratings view, но добавим функцию для удобства)
CREATE OR REPLACE FUNCTION public.get_weighted_rating(anime_id BIGINT)
RETURNS NUMERIC(6,2)
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(weighted_rating, 0) FROM public.anime_weighted_ratings WHERE anime_id = $1;
$$;

-- 4. Функция для получения популярности аниме (количество уникальных зрителей)
CREATE OR REPLACE FUNCTION public.get_anime_popularity(anime_id BIGINT)
RETURNS BIGINT
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(DISTINCT user_id) FROM (
    SELECT user_id FROM public.user_anime_list WHERE anime_id = $1 AND status IN ('completed', 'watching')
    UNION
    SELECT user_id FROM public.ratings WHERE anime_id = $1
  ) AS combined;
$$;