alter table public.fixtures
add column if not exists image_paths text[] default '{}'::text[];

update public.fixtures
set image_paths = '{}'::text[]
where image_paths is null;
