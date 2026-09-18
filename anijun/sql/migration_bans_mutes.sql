CREATE TABLE IF NOT EXISTS public.bans (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username TEXT,
  email TEXT,
  ip TEXT,
  reason TEXT DEFAULT '',
  banned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
ALTER TABLE public.bans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage bans" ON public.bans;
CREATE POLICY "Admins can manage bans" ON public.bans FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Admins can view bans" ON public.bans;
CREATE POLICY "Admins can view bans" ON public.bans FOR SELECT TO authenticated USING (public.is_admin());

CREATE TABLE IF NOT EXISTS public.mutes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username TEXT,
  email TEXT,
  ip TEXT,
  reason TEXT DEFAULT '',
  muted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
ALTER TABLE public.mutes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage mutes" ON public.mutes;
CREATE POLICY "Admins can manage mutes" ON public.mutes FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Admins can view mutes" ON public.mutes;
CREATE POLICY "Admins can view mutes" ON public.mutes FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete any review" ON public.reviews;
CREATE POLICY "Admins can delete any review" ON public.reviews FOR DELETE TO authenticated USING (public.is_admin());
