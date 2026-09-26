-- ==========================================
-- AniJUN — Публичное чтение бакета posts
-- Зачем: бакет posts создан без политик, поэтому загруженные файлы
-- отдавали 404 по публичному URL. Старые файлы в Anime не трогаем.
-- Идемпотентно, можно перезапускать.
-- ==========================================

insert into storage.buckets (id, name, public)
values ('posts', 'posts', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Public read posts" on storage.objects;
create policy "Public read posts"
  on storage.objects for select
  using (bucket_id = 'posts');

drop policy if exists "Public write posts" on storage.objects;
create policy "Public write posts"
  on storage.objects for insert
  with check (bucket_id = 'posts');

drop policy if exists "Public delete posts" on storage.objects;
create policy "Public delete posts"
  on storage.objects for delete
  using (bucket_id = 'posts');
