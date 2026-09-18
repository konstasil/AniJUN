ALTER TABLE public.bans ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.mutes ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.user_ips (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ip TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  last_seen TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, ip)
);
ALTER TABLE public.user_ips ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view user_ips" ON public.user_ips;
CREATE POLICY "Admins can view user_ips" ON public.user_ips FOR SELECT TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "Users can insert own ip" ON public.user_ips;
CREATE POLICY "Users can insert own ip" ON public.user_ips FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own ip" ON public.user_ips;
CREATE POLICY "Users can update own ip" ON public.user_ips FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.is_current_user_banned()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bans b
    WHERE (b.expires_at IS NULL OR b.expires_at > now())
      AND (
        b.user_id = auth.uid()
        OR b.email = auth.email()
        OR b.username = (SELECT username FROM public.profiles WHERE id = auth.uid())
        OR b.ip IN (SELECT ip FROM public.user_ips WHERE user_id = auth.uid())
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_current_user_muted()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mutes m
    WHERE (m.expires_at IS NULL OR m.expires_at > now())
      AND (
        m.user_id = auth.uid()
        OR m.email = auth.email()
        OR m.username = (SELECT username FROM public.profiles WHERE id = auth.uid())
        OR m.ip IN (SELECT ip FROM public.user_ips WHERE user_id = auth.uid())
      )
  );
$$;
