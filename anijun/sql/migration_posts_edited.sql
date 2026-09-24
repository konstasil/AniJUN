alter table public.posts add column if not exists updated_at timestamptz default now() not null;
create or replace function public.handle_posts_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;
drop trigger if exists posts_updated_at on public.posts;
create trigger posts_updated_at before update on public.posts for each row execute function public.handle_posts_updated_at();
