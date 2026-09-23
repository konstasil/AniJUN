create table if not exists public.post_comment_reports (
  id bigint generated always as identity primary key,
  comment_id bigint references public.post_comments(id) on delete cascade not null,
  reporter_id uuid references public.profiles(id) on delete cascade not null,
  reason text not null,
  created_at timestamptz default now() not null,
  status text default 'pending' check (status in ('pending','reviewed','rejected'))
);
alter table public.post_comment_reports enable row level security;
drop policy if exists "Users can report pc" on public.post_comment_reports;
create policy "Users can report pc" on public.post_comment_reports for insert to authenticated with check (auth.uid() = reporter_id);
drop policy if exists "Users can view own pc reports" on public.post_comment_reports;
create policy "Users can view own pc reports" on public.post_comment_reports for select to authenticated using (auth.uid() = reporter_id or public.is_admin());
drop policy if exists "Admins can manage pc reports" on public.post_comment_reports;
create policy "Admins can manage pc reports" on public.post_comment_reports for all to authenticated using (public.is_admin()) with check (public.is_admin());
create index if not exists idx_pc_reports_comment on public.post_comment_reports(comment_id);
