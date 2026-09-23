create table if not exists public.user_reports (
  id bigint generated always as identity primary key,
  reported_id uuid references public.profiles(id) on delete cascade not null,
  reporter_id uuid references public.profiles(id) on delete cascade not null,
  reason text not null,
  created_at timestamptz default now() not null,
  status text default 'pending' check (status in ('pending','reviewed','rejected'))
);
alter table public.user_reports enable row level security;
drop policy if exists "Users can report user" on public.user_reports;
create policy "Users can report user" on public.user_reports for insert to authenticated with check (auth.uid() = reporter_id);
drop policy if exists "Users can view own user reports" on public.user_reports;
create policy "Users can view own user reports" on public.user_reports for select to authenticated using (auth.uid() = reporter_id or public.is_admin());
drop policy if exists "Admins can manage user reports" on public.user_reports;
create policy "Admins can manage user reports" on public.user_reports for all to authenticated using (public.is_admin()) with check (public.is_admin());
create index if not exists idx_user_reports_reported on public.user_reports(reported_id);
create index if not exists idx_user_reports_status on public.user_reports(status);
