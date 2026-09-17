DROP POLICY IF EXISTS "Users can delete own suggestions" ON public.anime_suggestions;
CREATE POLICY "Users can delete own suggestions"
  ON public.anime_suggestions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can delete suggestions" ON public.anime_suggestions;
CREATE POLICY "Admins can delete suggestions"
  ON public.anime_suggestions FOR DELETE TO authenticated
  USING (public.is_admin());
