-- Добавляем колонку note для названия сезона (например "Сезон: Встреча")
ALTER TABLE public.anime_seasons
ADD COLUMN IF NOT EXISTS note TEXT DEFAULT '';