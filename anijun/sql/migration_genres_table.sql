CREATE TABLE IF NOT EXISTS public.genres (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
ALTER TABLE public.genres ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view genres" ON public.genres;
CREATE POLICY "Anyone can view genres" ON public.genres FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage genres" ON public.genres;
CREATE POLICY "Admins can manage genres" ON public.genres FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

INSERT INTO public.genres (name) VALUES
  ('Боевик'),('Экшен'),('Приключения'),('Комедия'),('Драма'),('Фантастика'),('Фэнтези'),('Хоррор'),('Меха'),('Музыка'),('Мистика'),('Психология'),('Романтика'),('Спорт'),('Повседневность'),('История'),('Военное'),('Детектив'),('Триллер'),('Сёнэн'),('Сёдзё'),('Сэйнэн'),('Игры'),('Школа'),('Суперсила'),('Сверхъестественное'),('Sci-Fi'),('Гарем'),('Реверс-Гарем'),('Исекай'),('Магия'),('Лгбт'),('Выживание'),('Этти'),('Боевые искусства'),('Айдолы'),('Лоли')
ON CONFLICT (name) DO NOTHING;
