-- ==========================================
-- AniJUN -- Статус тайтла (онгоинги / анонсы / завершено)
-- Добавляет anime.status: announced / ongoing / finished
-- Используется для реальных вкладок "Онгоинги" и "Анонсы" в каталоге
-- и для "Новости и анонсы" на главной.
-- Запускать в Supabase SQL Editor. Идемпотентно.
-- ==========================================

ALTER TABLE public.anime
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'finished'
  CHECK (status IN ('announced', 'ongoing', 'finished'));

-- Демо-бэкфилл (если есть такие тайтлы в базе -- пометить как онгоинги/анонс)
UPDATE public.anime SET status = 'ongoing'    WHERE title IN ('Поднятие уровня в одиночку', 'Дзюдзюцу Кайсен');
UPDATE public.anime SET status = 'announced'  WHERE title IN ('Милый во франксе');

-- Индекс для быстрых выборок по статусу
CREATE INDEX IF NOT EXISTS idx_anime_status ON public.anime(status);

-- Нормализация жанров: "Сёнен" → "Сёнэн" (единый список жанров в src/lib/genres.ts)
UPDATE public.anime
SET genres = ARRAY(
  SELECT CASE WHEN g = 'Сёнен' THEN 'Сёнэн' ELSE g END
  FROM unnest(genres) AS g
)
WHERE genres && ARRAY['Сёнен'];

-- ПРИМЕЧАНИЕ: политики RLS для anime не меняются -- SELECT разрешён всем,
-- insert/update/delete только админам (public.is_admin()).
