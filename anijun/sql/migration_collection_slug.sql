-- ==========================================
-- AniJUN — Отдельные страницы коллекций
-- Добавляет slug, чтобы ссылка была читаемой: /collection/<slug>
-- Идемпотентно.
-- ==========================================

alter table public.collections add column if not exists slug text;

update public.collections c
set slug = lower(regexp_replace(
  trim(both '-' from regexp_replace(
    regexp_replace(coalesce(c.name, 'collection'), '[^a-zA-Zа-яА-Я0-9\s-]', '', 'g'),
    '\s+', '-', 'g'
  )),
  '-+', '-', 'g'
))
where c.slug is null or c.slug = '';

-- уникализируем возможные совпадения
update public.collections c
set slug = c.slug || '-' || c.id
where c.slug in (
  select slug from public.collections group by slug having count(*) > 1
);

alter table public.collections alter column slug set default ('collection-' || substr(md5(random()::text), 1, 10));

do $$
begin
  if not exists (select 1 from pg_indexes where indexname = 'idx_collections_slug') then
    create unique index idx_collections_slug on public.collections(slug);
  end if;
end $$;

create or replace function public.handle_collections_slug() returns trigger as $$
begin
  if new.slug is null or new.slug = '' then
    new.slug := lower(trim(both '-' from regexp_replace(
      regexp_replace(
        regexp_replace(coalesce(new.name, 'collection'), '[^a-zA-Zа-яА-Я0-9\s-]', '', 'g'),
        '\s+', '-', 'g'
      ),
      '-+', '-', 'g'
    )));
  end if;
  if new.slug is null or new.slug = '' then
    new.slug := 'collection-' || substr(md5(random()::text), 1, 10);
  end if;
  return new;
end; $$ language plpgsql;

drop trigger if exists collections_slug on public.collections;
create trigger collections_slug before insert or update of name, slug on public.collections
for each row execute function public.handle_collections_slug();
