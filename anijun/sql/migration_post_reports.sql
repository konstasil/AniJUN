create table if not exists public.post_reports (
  id bigint generated always as identity primary key,
  post_id bigint references public.posts(id) on delete cascade not null,
  reporter_id uuid references public.profiles(id) on delete cascade not null,
  reason text not null,
  created_at timestamptz default now() not null,
  status text default 'pending' check (status in ('pending','reviewed','rejected'))
);
alter table public.post_reports enable row level security;
drop policy if exists "Users can report post" on public.post_reports;
create policy "Users can report post" on public.post_reports for insert to authenticated with check (auth.uid() = reporter_id);
drop policy if exists "Users can view own post reports" on public.post_reports;
create policy "Users can view own post reports" on public.post_reports for select to authenticated using (auth.uid() = reporter_id or public.is_admin());
create index if not exists idx_post_reports_post on public.post_reports(post_id);
