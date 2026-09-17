INSERT INTO public.admins (user_id) VALUES ('94eb649a-8da8-418c-a65a-6709a210dc9c') ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS "Admins can view admins" ON public.admins;
CREATE POLICY "Admins can view admins"
  ON public.admins FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage admins" ON public.admins;
CREATE POLICY "Admins can manage admins"
  ON public.admins FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
