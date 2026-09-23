alter table public.post_comments drop constraint if exists post_comments_parent_id_fkey;
alter table public.post_comments add constraint post_comments_parent_id_fkey foreign key (parent_id) references public.post_comments(id) on delete set null;

alter table public.comments drop constraint if exists comments_parent_id_fkey;
alter table public.comments add constraint comments_parent_id_fkey foreign key (parent_id) references public.comments(id) on delete set null;
