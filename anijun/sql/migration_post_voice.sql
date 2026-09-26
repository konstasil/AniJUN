alter table public.posts
  add column if not exists voice_url text,
  add column if not exists voice_duration double precision,
  add column if not exists voice_peaks jsonb;
