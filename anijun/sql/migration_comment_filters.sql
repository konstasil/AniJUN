CREATE TABLE IF NOT EXISTS public.comment_filters (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  word TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
ALTER TABLE public.comment_filters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view filters" ON public.comment_filters;
CREATE POLICY "Anyone can view filters" ON public.comment_filters FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage filters" ON public.comment_filters;
CREATE POLICY "Admins can manage filters" ON public.comment_filters FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
