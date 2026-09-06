-- ==========================================
-- Admin Simulation Support
-- Позволяет админам симулировать вход под другим пользователем
-- ==========================================

-- 1. Таблица для отслеживания активной симуляции
CREATE TABLE IF NOT EXISTS public.admin_simulations (
  admin_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  simulated_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (admin_id)
);

ALTER TABLE public.admin_simulations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view own simulation" ON public.admin_simulations;
CREATE POLICY "Admins can view own simulation"
  ON public.admin_simulations FOR SELECT
  USING (auth.uid() = admin_id);

DROP POLICY IF EXISTS "Admins can insert own simulation" ON public.admin_simulations;
CREATE POLICY "Admins can insert own simulation"
  ON public.admin_simulations FOR INSERT
  WITH CHECK (auth.uid() = admin_id);

DROP POLICY IF EXISTS "Admins can update own simulation" ON public.admin_simulations;
CREATE POLICY "Admins can update own simulation"
  ON public.admin_simulations FOR UPDATE
  USING (auth.uid() = admin_id);

DROP POLICY IF EXISTS "Admins can delete own simulation" ON public.admin_simulations;
CREATE POLICY "Admins can delete own simulation"
  ON public.admin_simulations FOR DELETE
  USING (auth.uid() = admin_id);

-- 2. Функция проверки: является ли текущий админ активным симулятором пользователя
CREATE OR REPLACE FUNCTION public.is_admin_simulating_user(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_simulations
    WHERE admin_id = auth.uid() AND simulated_user_id = target_user_id
  );
$$;

-- 3. Обновляем политики для user_anime_list
DROP POLICY IF EXISTS "Users can view own list" ON public.user_anime_list;
CREATE POLICY "Users can view own list"
  ON public.user_anime_list FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin_simulating_user(user_id));

DROP POLICY IF EXISTS "Users can manage own list" ON public.user_anime_list;
CREATE POLICY "Users can manage own list"
  ON public.user_anime_list FOR ALL
  USING (auth.uid() = user_id OR public.is_admin_simulating_user(user_id));

-- 4. Обновляем политики для ratings
DROP POLICY IF EXISTS "Anyone can view ratings" ON public.ratings;
CREATE POLICY "Anyone can view ratings"
  ON public.ratings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage own ratings" ON public.ratings;
CREATE POLICY "Users can manage own ratings"
  ON public.ratings FOR ALL
  USING (auth.uid() = user_id OR public.is_admin_simulating_user(user_id));

-- 5. Обновляем политики для episode_progress
DROP POLICY IF EXISTS "Users can view own progress" ON public.episode_progress;
CREATE POLICY "Users can view own progress"
  ON public.episode_progress FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin_simulating_user(user_id));

DROP POLICY IF EXISTS "Users can manage own progress" ON public.episode_progress;
CREATE POLICY "Users can manage own progress"
  ON public.episode_progress FOR ALL
  USING (auth.uid() = user_id OR public.is_admin_simulating_user(user_id));

-- 6. Триггер для автосоздания записи в profiles (если ещё нет)
CREATE OR REPLACE FUNCTION public.ensure_simulation_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.simulated_user_id, COALESCE(NEW.simulated_user_id::text, 'simulated'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_simulation_created ON public.admin_simulations;
CREATE TRIGGER on_simulation_created
  AFTER INSERT ON public.admin_simulations
  FOR EACH ROW EXECUTE FUNCTION public.ensure_simulation_profile();