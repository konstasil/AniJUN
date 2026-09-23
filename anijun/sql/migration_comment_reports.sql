create table if not exists public.comment_reports (
  id bigint generated always as identity primary key,
  comment_id bigint references public.comments(id) on delete cascade not null,
  reporter_id uuid references public.profiles(id) on delete cascade not null,
  reason text not null,
  created_at timestamptz default now() not null,
  status text default 'pending' check (status in ('pending','reviewed','rejected'))
);
alter table public.comment_reports enable row level security;
drop policy if exists "Users can report" on public.comment_reports;
create policy "Users can report" on public.comment_reports for insert to authenticated with check (auth.uid() = reporter_id);
drop policy if exists "Users can view own reports" on public.comment_reports;
create policy "Users can view own reports" on public.comment_reports for select to authenticated using (auth.uid() = reporter_id or public.is_admin());
drop policy if exists "Admins can manage reports" on public.comment_reports;
create policy "Admins can manage reports" on public.comment_reports for all to authenticated using (public.is_admin()) with check (public.is_admin());
create index if not exists idx_reports_comment on public.comment_reports(comment_id);
create index if not exists idx_reports_status on public.comment_reports(status);
