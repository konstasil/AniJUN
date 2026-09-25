create table if not exists public.admin_actions (
  id bigint generated always as identity primary key,
  admin_id uuid references public.profiles(id) on delete cascade not null,
  action text not null check (action in ('add','delete','update','approve','reject')),
  entity_type text not null check (entity_type in ('anime','season','comment','post','post_comment','suggestion','user','report')),
  entity_id text,
  tab text,
  is_duplicate boolean default false not null,
  created_at timestamptz default now() not null
);
alter table public.admin_actions enable row level security;
drop policy if exists "Admins can view stats" on public.admin_actions;
create policy "Admins can view stats" on public.admin_actions for select to authenticated using (public.is_admin());
drop policy if exists "Admins can insert stats" on public.admin_actions;
create policy "Admins can insert stats" on public.admin_actions for insert to authenticated with check (public.is_admin() and auth.uid() = admin_id);
create index if not exists idx_admin_actions_admin on public.admin_actions(admin_id);
create index if not exists idx_admin_actions_created on public.admin_actions(created_at desc);
