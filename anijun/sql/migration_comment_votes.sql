CREATE TABLE IF NOT EXISTS public.comment_votes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  comment_id BIGINT REFERENCES public.comments(id) ON DELETE CASCADE NOT NULL,
  vote SMALLINT NOT NULL CHECK (vote IN (1, -1)),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, comment_id)
);
ALTER TABLE public.comment_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view comment votes" ON public.comment_votes;
CREATE POLICY "Anyone can view comment votes" ON public.comment_votes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can vote" ON public.comment_votes;
CREATE POLICY "Users can vote" ON public.comment_votes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own vote" ON public.comment_votes;
CREATE POLICY "Users can update own vote" ON public.comment_votes FOR UPDATE TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own vote" ON public.comment_votes;
CREATE POLICY "Users can delete own vote" ON public.comment_votes FOR DELETE TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can delete any vote" ON public.comment_votes;
CREATE POLICY "Admins can delete any vote" ON public.comment_votes FOR DELETE TO authenticated USING (public.is_admin());
CREATE INDEX IF NOT EXISTS idx_comment_votes_comment ON public.comment_votes(comment_id);

DROP POLICY IF EXISTS "Users can update own comment" ON public.comments;
CREATE POLICY "Users can update own comment" ON public.comments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can delete any comment" ON public.comments;
CREATE POLICY "Admins can delete any comment" ON public.comments FOR DELETE TO authenticated USING (public.is_admin() OR auth.uid() = user_id);
