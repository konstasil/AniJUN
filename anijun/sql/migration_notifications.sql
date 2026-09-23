create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  actor_id uuid references public.profiles(id) on delete cascade not null,
  type text not null check (type in ('reply','mention','post')),
  target_id bigint,
  created_at timestamptz default now() not null,
  is_read boolean default false not null
);
alter table public.notifications enable row level security;
drop policy if exists "Users can view own notifs" on public.notifications;
create policy "Users can view own notifs" on public.notifications for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can update own notifs" on public.notifications;
create policy "Users can update own notifs" on public.notifications for update to authenticated using (auth.uid() = user_id);
drop policy if exists "System can insert notifs" on public.notifications;
create policy "System can insert notifs" on public.notifications for insert to authenticated with check (true);
create index if not exists idx_notifs_user on public.notifications(user_id, is_read, created_at desc);
