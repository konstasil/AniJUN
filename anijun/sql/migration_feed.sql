create table if not exists public.posts (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  text text not null,
  anime_id bigint references public.anime(id) on delete set null,
  image_url text,
  created_at timestamptz default now() not null
);
alter table public.posts enable row level security;
drop policy if exists "Anyone can view posts" on public.posts;
create policy "Anyone can view posts" on public.posts for select using (true);
drop policy if exists "Users can insert post" on public.posts;
create policy "Users can insert post" on public.posts for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can delete own post" on public.posts;
create policy "Users can delete own post" on public.posts for delete to authenticated using (auth.uid() = user_id or public.is_admin());
drop policy if exists "Users can update own post" on public.posts;
create policy "Users can update own post" on public.posts for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.post_likes (
  post_id bigint references public.posts(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  primary key (post_id, user_id)
);
alter table public.post_likes enable row level security;
drop policy if exists "Anyone can view post_likes" on public.post_likes;
create policy "Anyone can view post_likes" on public.post_likes for select using (true);
drop policy if exists "Users can like" on public.post_likes;
create policy "Users can like" on public.post_likes for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can unlike" on public.post_likes;
create policy "Users can unlike" on public.post_likes for delete to authenticated using (auth.uid() = user_id);

create table if not exists public.post_comments (
  id bigint generated always as identity primary key,
  post_id bigint references public.posts(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  text text not null,
  created_at timestamptz default now() not null
);
alter table public.post_comments enable row level security;
drop policy if exists "Anyone can view post_comments" on public.post_comments;
create policy "Anyone can view post_comments" on public.post_comments for select using (true);
drop policy if exists "Users can comment post" on public.post_comments;
create policy "Users can comment post" on public.post_comments for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can delete own post comment" on public.post_comments;
create policy "Users can delete own post comment" on public.post_comments for delete to authenticated using (auth.uid() = user_id or public.is_admin());

create index if not exists idx_posts_user_id on public.posts(user_id);
create index if not exists idx_posts_created_at on public.posts(created_at desc);
create index if not exists idx_post_likes_post on public.post_likes(post_id);
create index if not exists idx_post_comments_post on public.post_comments(post_id);
