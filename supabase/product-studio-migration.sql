alter table public.products add column if not exists garment_type text not null default '';
alter table public.products add column if not exists set_includes text not null default '';
alter table public.products add column if not exists lengths text[] not null default '{}';
alter table public.products add column if not exists fit text not null default '';
alter table public.products add column if not exists fabric text not null default '';
alter table public.products add column if not exists specifications jsonb not null default '[]'::jsonb;
