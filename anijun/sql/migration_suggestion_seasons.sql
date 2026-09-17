ALTER TABLE public.anime_suggestions
  ADD COLUMN IF NOT EXISTS seasons JSONB DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.approve_suggestion(sugg_id BIGINT)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  s public.anime_suggestions%ROWTYPE;
  new_anime_id BIGINT;
  season_item JSONB;
  idx INT := 0;
  has_seasons BOOLEAN;
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

  has_seasons := (s.seasons IS NOT NULL AND jsonb_typeof(s.seasons) = 'array' AND jsonb_array_length(s.seasons) > 0);

  IF has_seasons THEN
    FOR season_item IN SELECT * FROM jsonb_array_elements(s.seasons)
    LOOP
      idx := idx + 1;
      INSERT INTO public.anime_seasons (anime_id, season_number, episodes_count, note)
      VALUES (
        new_anime_id,
        COALESCE((season_item->>'number')::INT, idx),
        COALESCE((season_item->>'episodes')::INT, 12),
        COALESCE(season_item->>'note', '')
      );
    END LOOP;
  ELSE
    INSERT INTO public.anime_seasons (anime_id, season_number, episodes_count, note)
    VALUES (new_anime_id, 1, 12, '');
  END IF;

  UPDATE public.anime_suggestions
  SET status = 'accepted', reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = sugg_id;

  RETURN new_anime_id;
END;
$$;
