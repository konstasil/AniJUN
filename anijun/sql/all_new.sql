CREATE TABLE IF NOT EXISTS public.admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);

INSERT INTO public.admins (user_id) VALUES
  ('8fa96992-b063-4019-83a6-3acac8cc712f'),
  ('cc91e0bb-a24b-41ab-ba41-3bd352ed9add')
ON CONFLICT DO NOTHING;

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

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

CREATE TABLE IF NOT EXISTS public.admin_simulations (
  admin_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  simulated_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (admin_id)
);

ALTER TABLE public.admin_simulations ENABLE ROW LEVEL SECURITY;

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

ALTER TABLE public.anime_suggestions
  DROP CONSTRAINT IF EXISTS anime_suggestions_status_check;

ALTER TABLE public.anime_suggestions
  ADD CONSTRAINT anime_suggestions_status_check
  CHECK (status IN ('pending', 'new', 'in_review', 'accepted', 'rejected'));

ALTER TABLE public.anime_suggestions
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.anime_suggestions
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

ALTER TABLE public.anime_suggestions
  ADD COLUMN IF NOT EXISTS link TEXT DEFAULT '';

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

ALTER TABLE public.anime
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'finished'
  CHECK (status IN ('announced', 'ongoing', 'finished'));

UPDATE public.anime SET status = 'ongoing' WHERE title IN ('Поднятие уровня в одиночку', 'Дзюдзюцу Кайсен');
UPDATE public.anime SET status = 'announced' WHERE title IN ('Милый во франксе');

CREATE INDEX IF NOT EXISTS idx_anime_status ON public.anime(status);

UPDATE public.anime
SET genres = ARRAY(
  SELECT CASE WHEN g = 'Сёнен' THEN 'Сёнэн' ELSE g END
  FROM unnest(genres) AS g
)
WHERE genres && ARRAY['Сёнен'];

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

CREATE TABLE IF NOT EXISTS public.collection_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  collection_id BIGINT REFERENCES public.collections(id) ON DELETE CASCADE NOT NULL,
  anime_id BIGINT REFERENCES public.anime(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(collection_id, anime_id)
);

ALTER TABLE public.collection_items ENABLE ROW LEVEL SECURITY;

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
