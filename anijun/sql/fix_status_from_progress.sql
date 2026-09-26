-- ==========================================
-- AniJUN — Синхронизация статусов с прогрессом просмотра
-- Проблема: у части пользователей статус «Просмотрено»/«Смотрю» остался,
-- но episode_progress пуст (сезоны пересоздавались админом → ON DELETE CASCADE
-- удалял строки прогресса). Из-за этого на странице аниме статус «Просмотрено»,
-- а в каталоге 0/N серий.
-- Что делает: пересчитывает статус watching/completed по фактическим отметкам.
-- Не трогает planned / on_hold / dropped.
-- ВАЖНО: пустой статус недопустим (CHECK), поэтому вместо '' удаляем строку.
-- ==========================================

-- 1. completed -> watching, если отмечена часть серий, но не все
update public.user_anime_list l
set status = 'watching'
where l.status = 'completed'
  and exists (
    select 1 from public.episode_progress p
    where p.user_id = l.user_id
      and p.watched = true
      and p.season_id in (select s.id from public.anime_seasons s where s.anime_id = l.anime_id)
  )
  and (
    select count(*) filter (where p.watched = true)
    from public.episode_progress p
    where p.user_id = l.user_id
      and p.season_id in (select s.id from public.anime_seasons s where s.anime_id = l.anime_id)
  ) < (
    select coalesce(sum(s.episodes_count), 0)
    from public.anime_seasons s
    where s.anime_id = l.anime_id
  );

-- 2. completed без прогресса -> удалить строку
delete from public.user_anime_list l
where l.status = 'completed'
  and not exists (
    select 1 from public.episode_progress p
    where p.user_id = l.user_id
      and p.watched = true
      and p.season_id in (select s.id from public.anime_seasons s where s.anime_id = l.anime_id)
  );

-- 3. watching без прогресса -> удалить строку
delete from public.user_anime_list l
where l.status = 'watching'
  and not exists (
    select 1 from public.episode_progress p
    where p.user_id = l.user_id
      and p.watched = true
      and p.season_id in (select s.id from public.anime_seasons s where s.anime_id = l.anime_id)
  );
