-- ==========================================
-- AniJUN -- Сообщество: отзывы, комментарии, коллекции, подписки (SQL-каркас)
-- ЗАВИСИМОСТИ: нужно сначала применить migration_simulation.sql
-- (используется public.is_admin_simulating_user).
-- Запускать в Supabase SQL Editor. Идемпотентно.
-- ==========================================

-- ============ 1. ОТЗЫВЫ (один на пользователя на тайтл) ============
CREATE TABLE IF NOT EXISTS public.reviews (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  anime_id BIGINT REFERENCES public.anime(id) ON DELETE CASCADE NOT NULL,
  rating INTEGER NOT NULL DEFAULT 7 CHECK (rating BETWEEN 1 AND 10),
  text TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, anime_id)
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view reviews" ON public.reviews;
CREATE POLICY "Anyone can view reviews"
  ON public.reviews FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own review" ON public.reviews;
CREATE POLICY "Users can insert own review"
  ON public.reviews FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_admin_simulating_user(user_id));

DROP POLICY IF EXISTS "Users can update own review" ON public.reviews;
CREATE POLICY "Users can update own review"
  ON public.reviews FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_admin_simulating_user(user_id));

DROP POLICY IF EXISTS "Users can delete own review" ON public.reviews;
CREATE POLICY "Users can delete own review"
  ON public.reviews FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_admin_simulating_user(user_id));

CREATE INDEX IF NOT EXISTS idx_reviews_anime_id ON public.reviews(anime_id);

-- ============ 2. КОММЕНТАРИИ (вложенные) ============
CREATE TABLE IF NOT EXISTS public.comments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  anime_id BIGINT REFERENCES public.anime(id) ON DELETE CASCADE NOT NULL,
  parent_id BIGINT REFERENCES public.comments(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view comments" ON public.comments;
CREATE POLICY "Anyone can view comments"
  ON public.comments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert comment" ON public.comments;
CREATE POLICY "Users can insert comment"
  ON public.comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_admin_simulating_user(user_id));

DROP POLICY IF EXISTS "Users can delete own comment" ON public.comments;
CREATE POLICY "Users can delete own comment"
  ON public.comments FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_admin_simulating_user(user_id));

CREATE INDEX IF NOT EXISTS idx_comments_anime_id ON public.comments(anime_id);

-- ============ 3. КОЛЛЕКЦИИ ============
CREATE TABLE IF NOT EXISTS public.collections (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view public collections" ON public.collections;
CREATE POLICY "Anyone can view public collections"
  ON public.collections FOR SELECT
  USING (is_public OR auth.uid() = user_id OR public.is_admin_simulating_user(user_id));

DROP POLICY IF EXISTS "Users can insert own collection" ON public.collections;
CREATE POLICY "Users can insert own collection"
  ON public.collections FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_admin_simulating_user(user_id));

DROP POLICY IF EXISTS "Users can update own collection" ON public.collections;
CREATE POLICY "Users can update own collection"
  ON public.collections FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_admin_simulating_user(user_id));

DROP POLICY IF EXISTS "Users can delete own collection" ON public.collections;
CREATE POLICY "Users can delete own collection"
  ON public.collections FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_admin_simulating_user(user_id));

-- ============ 4. ЭЛЕМЕНТЫ КОЛЛЕКЦИЙ ============
CREATE TABLE IF NOT EXISTS public.collection_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  collection_id BIGINT REFERENCES public.collections(id) ON DELETE CASCADE NOT NULL,
  anime_id BIGINT REFERENCES public.anime(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(collection_id, anime_id)
);

ALTER TABLE public.collection_items ENABLE ROW LEVEL SECURITY;

-- Хелперы с SECURITY DEFINER, чтобы политики не рекурсили через RLS
CREATE OR REPLACE FUNCTION public.owns_collection(c BIGINT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.collections
    WHERE id = c AND (user_id = auth.uid() OR public.is_admin_simulating_user(user_id))
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_collection(c BIGINT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.collections
    WHERE id = c AND (is_public OR user_id = auth.uid() OR public.is_admin_simulating_user(user_id))
  );
$$;

DROP POLICY IF EXISTS "View collection items if collection visible" ON public.collection_items;
CREATE POLICY "View collection items if collection visible"
  ON public.collection_items FOR SELECT
  USING (public.can_view_collection(collection_id));

DROP POLICY IF EXISTS "Owners can insert collection items" ON public.collection_items;
CREATE POLICY "Owners can insert collection items"
  ON public.collection_items FOR INSERT TO authenticated
  WITH CHECK (public.owns_collection(collection_id));

DROP POLICY IF EXISTS "Owners can update collection items" ON public.collection_items;
CREATE POLICY "Owners can update collection items"
  ON public.collection_items FOR UPDATE TO authenticated
  USING (public.owns_collection(collection_id));

DROP POLICY IF EXISTS "Owners can delete collection items" ON public.collection_items;
CREATE POLICY "Owners can delete collection items"
  ON public.collection_items FOR DELETE TO authenticated
  USING (public.owns_collection(collection_id));

CREATE INDEX IF NOT EXISTS idx_collection_items_collection ON public.collection_items(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_items_anime ON public.collection_items(anime_id);

-- ============ 5. ПОДПИСКИ НА ПОЛЬЗОВАТЕЛЕЙ ============
CREATE TABLE IF NOT EXISTS public.user_follows (
  follower_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  following_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own follows" ON public.user_follows;
CREATE POLICY "Users can view own follows"
  ON public.user_follows FOR SELECT
  USING (
    follower_id = auth.uid() OR following_id = auth.uid() OR public.is_admin()
  );

DROP POLICY IF EXISTS "Users can follow" ON public.user_follows;
CREATE POLICY "Users can follow"
  ON public.user_follows FOR INSERT TO authenticated
  WITH CHECK (follower_id = auth.uid() OR public.is_admin_simulating_user(follower_id));

DROP POLICY IF EXISTS "Users can unfollow" ON public.user_follows;
CREATE POLICY "Users can unfollow"
  ON public.user_follows FOR DELETE TO authenticated
  USING (follower_id = auth.uid() OR public.is_admin_simulating_user(follower_id));

CREATE INDEX IF NOT EXISTS idx_user_follows_following ON public.user_follows(following_id);

-- ==========================================
-- ПРИМЕЧАНИЕ: UI уже подключён (отзывы + коллекции на странице аниме,
-- коллекции в профиле). Комментарии (вложенные) пока только таблица --
-- UI появится позже.
-- ==========================================
