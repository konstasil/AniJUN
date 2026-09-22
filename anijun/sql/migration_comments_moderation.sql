ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected'));
UPDATE public.comments SET status = 'approved' WHERE status IS NULL;

DROP POLICY IF EXISTS "Anyone can view comments" ON public.comments;
CREATE POLICY "Anyone can view approved comments" ON public.comments FOR SELECT USING (status = 'approved');
DROP POLICY IF EXISTS "Users can view own pending" ON public.comments;
CREATE POLICY "Users can view own pending" ON public.comments FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can view all comments" ON public.comments;
CREATE POLICY "Admins can view all comments" ON public.comments FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Users can insert comment" ON public.comments;
CREATE POLICY "Users can insert comment" ON public.comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can moderate comments" ON public.comments;
CREATE POLICY "Admins can moderate comments" ON public.comments FOR UPDATE TO authenticated USING (public.is_admin());
