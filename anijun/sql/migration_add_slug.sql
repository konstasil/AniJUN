-- 1. Добавляем колонку slug в таблицу anime
ALTER TABLE public.anime ADD COLUMN IF NOT EXISTS slug TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_anime_slug ON public.anime(slug);

-- 2. Генерируем slug для существующих записей (транслитерация + lowercase)
-- Для английских названий просто lower + replace пробелов
-- Для русских -- используем простую транслитерацию
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
WHERE slug IS NULL;

-- Удаляем trailing/leading дефисы
UPDATE public.anime
SET slug = TRIM(BOTH '-' FROM slug)
WHERE slug IS NULL OR slug != TRIM(BOTH '-' FROM slug);

-- Разрешаем NULL для slug (старые записи)
-- При вставке новых slug будет генерирoоваться кодом