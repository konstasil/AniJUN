-- ==========================================
-- AniJUN — Политики бакета posts (безопасные)
-- Проблема: сплошная политика delete позволяла бы удалять чужие файлы.
-- Решение: путь файла = <user_id>/<file>, политики проверяют владельца.
-- Старые файлы в Anime и файлы без префикса в posts не удаляются — это ок.
-- Идемпотентно.
-- ==========================================

insert into storage.buckets (id, name, public)
values ('posts', 'posts', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Public read posts" on storage.objects;
create policy "Public read posts"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'posts');

drop policy if exists "Public write posts" on storage.objects;
create policy "Public write posts"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'posts');

drop policy if exists "Owner delete posts" on storage.objects;
create policy "Owner delete posts"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'posts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Owner update posts" on storage.objects;
create policy "Owner update posts"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'posts'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'posts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
