-- ==========================================
-- AniJUN -- Модерация предложений аниме
-- Что делает:
--   1) Расширяет статусы anime_suggestions до: pending / new / in_review / accepted / rejected
--      (pending оставлен для совместимости с текущим кодом /suggest)
--   2) Добавляет поля reviewed_by / reviewed_at для админ-модерации
--   3) Функция approve_suggestion(id): атомарно создаёт аниме + сезон и помечает заявку accepted
--   4) Триггер авто-генерации slug при вставке в anime (если slug пустой)
-- Запускать в Supabase SQL Editor. Идемпотентно (можно перезапускать).
-- ==========================================

-- 1. Расширяем возможные статусы заявки
ALTER TABLE public.anime_suggestions
  DROP CONSTRAINT IF EXISTS anime_suggestions_status_check;

ALTER TABLE public.anime_suggestions
  ADD CONSTRAINT anime_suggestions_status_check
  CHECK (status IN ('pending', 'new', 'in_review', 'accepted', 'rejected'));

-- 2. Поля модерации
ALTER TABLE public.anime_suggestions
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.anime_suggestions
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- Ссылка на источник (MAL / AniList / Kinopoisk / IMDB и т.п.)
ALTER TABLE public.anime_suggestions
  ADD COLUMN IF NOT EXISTS link TEXT DEFAULT '';

-- 3. Функция одобрения заявки: создаёт аниме + сезон, отмечает заявку accepted
--    Вызывается только админами (проверка через public.is_admin()).
--    Возвращает id созданного аниме (NULL если заявка уже принята / не найдена).
CREATE OR REPLACE FUNCTION public.approve_suggestion(sugg_id BIGINT)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  s public.anime_suggestions%ROWTYPE;
  new_anime_id BIGINT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Доступ запрещён';
  END IF;

  SELECT * INTO s FROM public.anime_suggestions WHERE id = sugg_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF s.status = 'accepted' THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.anime (title, slug, image_url, genres, season_info, age_rating)
  VALUES (
    s.title,
    LOWER(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(s.title, '[^a-zA-Zа-яА-Я0-9\s-]', '', 'g'),
          '\s+', '-', 'g'
        ),
        '-+', '-', 'g'
      )
    ),
    COALESCE(NULLIF(s.image_url, ''), 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&q=80'),
    COALESCE(s.genres, '{}'),
    COALESCE(NULLIF(s.season_info, ''), 'Не указан'),
    COALESCE(NULLIF(s.age_rating, ''), '16+')
  )
  RETURNING id INTO new_anime_id;

  INSERT INTO public.anime_seasons (anime_id, season_number, episodes_count)
  VALUES (new_anime_id, 1, 12);

  UPDATE public.anime_suggestions
  SET status = 'accepted', reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = sugg_id;

  RETURN new_anime_id;
END;
$$;

-- Функция отклонения заявки (для админки)
CREATE OR REPLACE FUNCTION public.reject_suggestion(sugg_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Доступ запрещён';
  END IF;

  UPDATE public.anime_suggestions
  SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = sugg_id;
END;
$$;

-- 4. Триггер: авто-генерация slug при вставке, если slug не заполнен
CREATE OR REPLACE FUNCTION public.generate_anime_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := LOWER(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(NEW.title, '[^a-zA-Zа-яА-Я0-9\s-]', '', 'g'),
          '\s+', '-', 'g'
        ),
        '-+', '-', 'g'
      )
    );
    NEW.slug := TRIM(BOTH '-' FROM NEW.slug);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_anime_insert_generate_slug ON public.anime;
CREATE TRIGGER on_anime_insert_generate_slug
  BEFORE INSERT ON public.anime
  FOR EACH ROW EXECUTE FUNCTION public.generate_anime_slug();

-- ==========================================
-- Заметки по применению:
--   После apply этого файла в админке появится вкладка "Предложения" (см. 1.txt).
--   Статусы: pending (старые записи) → new → in_review → accepted / rejected.
--   Ссылка на функцию из UI: supabase.rpc('approve_suggestion', { sugg_id }).
-- ==========================================
