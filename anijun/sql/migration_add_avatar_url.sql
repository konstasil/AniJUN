-- Миграция: добавляем колонку avatar_url в таблицу profiles, если её нет     
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT '';

-- Добавляем RLS политики для UPDATE и DELETE на storage.objects для bucket 'users'
-- (нужны для upsert-перезаписи аватарки с фиксированным именем userId/avatar.ext)
DROP POLICY IF EXISTS "Avatar update for own profile" ON storage.objects;
CREATE POLICY "Avatar update for own profile"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'users' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'users' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Avatar delete for own profile" ON storage.objects;
CREATE POLICY "Avatar delete for own profile"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'users' AND auth.uid()::text = (storage.foldername(name))[1]);
