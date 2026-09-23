alter table public.anime_seasons add column if not exists aired_episodes integer;
update public.anime_seasons set aired_episodes = episodes_count where aired_episodes is null;
