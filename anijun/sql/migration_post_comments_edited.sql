alter table public.post_comments add column if not exists updated_at timestamptz default now() not null;
update public.post_comments set updated_at = created_at where updated_at != created_at;
create or replace function public.handle_pc_updated_at() returns trigger as $$
begin
  if new.updated_at is not distinct from old.updated_at then new.updated_at = now(); end if;
  return new;
end; $$ language plpgsql;
drop trigger if exists pc_updated_at on public.post_comments;
create trigger pc_updated_at before update on public.post_comments for each row execute function public.handle_pc_updated_at();
