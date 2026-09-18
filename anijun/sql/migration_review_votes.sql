CREATE TABLE IF NOT EXISTS public.review_votes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  review_id BIGINT REFERENCES public.reviews(id) ON DELETE CASCADE NOT NULL,
  vote SMALLINT NOT NULL CHECK (vote IN (1, -1)),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, review_id)
);
ALTER TABLE public.review_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view review votes" ON public.review_votes;
CREATE POLICY "Anyone can view review votes" ON public.review_votes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can vote review" ON public.review_votes;
CREATE POLICY "Users can vote review" ON public.review_votes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own review vote" ON public.review_votes;
CREATE POLICY "Users can update own review vote" ON public.review_votes FOR UPDATE TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own review vote" ON public.review_votes;
CREATE POLICY "Users can delete own review vote" ON public.review_votes FOR DELETE TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can delete any review vote" ON public.review_votes;
CREATE POLICY "Admins can delete any review vote" ON public.review_votes FOR DELETE TO authenticated USING (public.is_admin());
CREATE INDEX IF NOT EXISTS idx_review_votes_review ON public.review_votes(review_id);
