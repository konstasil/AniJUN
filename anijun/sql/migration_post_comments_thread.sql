alter table public.post_comments add column if not exists parent_id bigint references public.post_comments(id) on delete cascade;
create index if not exists idx_post_comments_parent on public.post_comments(parent_id);

create table if not exists public.post_comment_likes (
  comment_id bigint references public.post_comments(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  primary key (comment_id, user_id)
);
alter table public.post_comment_likes enable row level security;
drop policy if exists "Anyone can view pc likes" on public.post_comment_likes;
create policy "Anyone can view pc likes" on public.post_comment_likes for select using (true);
drop policy if exists "Users can like pc" on public.post_comment_likes;
create policy "Users can like pc" on public.post_comment_likes for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can unlike pc" on public.post_comment_likes;
create policy "Users can unlike pc" on public.post_comment_likes for delete to authenticated using (auth.uid() = user_id);
