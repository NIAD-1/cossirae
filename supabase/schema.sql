create extension if not exists pgcrypto;

create table if not exists public.admin_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('admin', 'owner')),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_roles
    where user_id = auth.uid()
  );
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null,
  description text,
  price_ngn integer not null check (price_ngn >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  sizes text[] not null default '{}',
  colours text[] not null default '{}',
  garment_type text not null default '',
  set_includes text not null default '',
  lengths text[] not null default '{}',
  fit text not null default '',
  fabric text not null default '',
  specifications jsonb not null default '[]'::jsonb,
  image_urls text[] not null default '{}',
  video_urls text[] not null default '{}',
  fabric_and_care text,
  is_active boolean not null default true,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products add column if not exists garment_type text not null default '';
alter table public.products add column if not exists set_includes text not null default '';
alter table public.products add column if not exists lengths text[] not null default '{}';
alter table public.products add column if not exists fit text not null default '';
alter table public.products add column if not exists fabric text not null default '';
alter table public.products add column if not exists specifications jsonb not null default '[]'::jsonb;

create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text not null unique,
  full_name text,
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  delivery_address text not null,
  delivery_city text not null,
  payment_method text not null default 'paystack',
  payment_reference text unique,
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'failed', 'cancelled')),
  order_status text not null default 'new' check (order_status in ('new', 'processing', 'shipped', 'delivered', 'cancelled')),
  subtotal_ngn integer not null check (subtotal_ngn >= 0),
  total_ngn integer not null check (total_ngn >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_slug text not null,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price_ngn integer not null check (unit_price_ngn >= 0),
  line_total_ngn integer not null check (line_total_ngn >= 0)
);

create table if not exists public.product_submissions (
  id uuid primary key default gen_random_uuid(),
  product_name text not null,
  category text not null,
  price_ngn integer,
  stock_quantity integer,
  sizes text,
  colours text,
  description text,
  fabric_and_care text,
  image_file_names text,
  extra_notes text,
  status text not null default 'new' check (status in ('new', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.app_logs (
  id uuid primary key default gen_random_uuid(),
  level text not null default 'info' check (level in ('debug', 'info', 'warn', 'error')),
  source text not null,
  message text not null,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-media',
  'product-media',
  true,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.admin_roles enable row level security;
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.product_categories enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.product_submissions enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.app_logs enable row level security;

drop policy if exists "Admins can read admin roles" on public.admin_roles;
create policy "Admins can read admin roles"
  on public.admin_roles for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can manage admin roles" on public.admin_roles;
create policy "Admins can manage admin roles"
  on public.admin_roles for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id or public.is_admin());

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id or public.is_admin())
  with check ((select auth.uid()) = id or public.is_admin());

drop policy if exists "Users can create own profile" on public.profiles;
create policy "Users can create own profile"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "Public can read active products" on public.products;
create policy "Public can read active products"
  on public.products for select
  using (is_active = true);

drop policy if exists "Public can read active product categories" on public.product_categories;
create policy "Public can read active product categories"
  on public.product_categories for select
  using (is_active = true);

drop policy if exists "Authenticated admins can manage products" on public.products;
create policy "Admins can manage products"
  on public.products for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Authenticated admins can manage product categories" on public.product_categories;
create policy "Admins can manage product categories"
  on public.product_categories for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Authenticated admins can read orders" on public.orders;
create policy "Admins and customers can read orders"
  on public.orders for select
  to authenticated
  using (public.is_admin() or (select auth.uid()) = user_id);

drop policy if exists "Authenticated admins can update orders" on public.orders;
create policy "Admins can update orders"
  on public.orders for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Public can create customers" on public.customers;
create policy "Public can create customers"
  on public.customers for insert
  with check (user_id is null or (select auth.uid()) = user_id);

drop policy if exists "Customers can read own customer profile" on public.customers;
create policy "Customers can read own customer profile"
  on public.customers for select
  to authenticated
  using (public.is_admin() or (select auth.uid()) = user_id);

drop policy if exists "Public can create orders" on public.orders;
create policy "Public can create orders"
  on public.orders for insert
  with check (user_id is null or (select auth.uid()) = user_id);

drop policy if exists "Public can create order items" on public.order_items;
create policy "Public can create order items"
  on public.order_items for insert
  with check (true);

drop policy if exists "Admins and order owners can read order items" on public.order_items;
create policy "Admins and order owners can read order items"
  on public.order_items for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
      and orders.user_id = (select auth.uid())
    )
  );

drop policy if exists "Public can create product submissions" on public.product_submissions;
create policy "Public can create product submissions"
  on public.product_submissions for insert
  with check (true);

drop policy if exists "Public can join newsletter" on public.newsletter_subscribers;
create policy "Public can join newsletter"
  on public.newsletter_subscribers for insert
  with check (true);

drop policy if exists "Admins can read app logs" on public.app_logs;
create policy "Admins can read app logs"
  on public.app_logs for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Service can write app logs" on public.app_logs;

drop policy if exists "Public can read product media" on storage.objects;
create policy "Public can read product media"
  on storage.objects for select
  using (bucket_id = 'product-media');

drop policy if exists "Admins can upload product media" on storage.objects;
create policy "Admins can upload product media"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-media' and public.is_admin());

drop policy if exists "Admins can update product media" on storage.objects;
create policy "Admins can update product media"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-media' and public.is_admin())
  with check (bucket_id = 'product-media' and public.is_admin());

drop policy if exists "Admins can delete product media" on storage.objects;
create policy "Admins can delete product media"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-media' and public.is_admin());

insert into public.product_categories (name, slug, description)
values
  ('Dresses', 'dresses', 'Statement dresses and flowing silhouettes.'),
  ('Kaftans', 'kaftans', 'Elegant kaftans for ease and occasion dressing.'),
  ('Sets', 'sets', 'Coordinated two-piece looks.'),
  ('Tops', 'tops', 'Shirts, blouses and refined tops.'),
  ('Accessories', 'accessories', 'Jewellery and finishing pieces.')
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description;

insert into public.products (slug, name, category, description, price_ngn, stock_quantity, sizes, colours, image_urls, video_urls, is_featured)
values
  ('abeni-maxi-dress', 'Abeni Maxi Dress', 'Dresses', 'Flowing rust print maxi dress with a refined African silhouette.', 85000, 12, array['S','M','L','XL'], array['Rust Print','Black','Olive'], array['assets/images/product-abeni-1.jpg'], array[]::text[], true),
  ('tunde-kaftan', 'Tunde Kaftan', 'Kaftans', 'Elegant black kaftan cut for ease, movement and occasion dressing.', 75000, 8, array['S','M','L','XL'], array['Black','Sand'], array[]::text[], array[]::text[], true),
  ('ife-blazer-set', 'Ife Blazer Set', 'Sets', 'Structured set with a contemporary finish for the modern woman.', 120000, 6, array['S','M','L'], array['Terracotta','Ivory'], array[]::text[], array[]::text[], true),
  ('zuri-shirt-set', 'Zuri Shirt Set', 'Sets', 'Relaxed shirt set with warm textile-inspired styling.', 95000, 9, array['S','M','L','XL'], array['Espresso','Clay'], array[]::text[], array[]::text[], false),
  ('kele-shirt', 'Kele Shirt', 'Tops', 'Clean ivory shirt with subtle detailing and everyday polish.', 48000, 15, array['S','M','L','XL'], array['Ivory','Black'], array[]::text[], array[]::text[], false),
  ('sade-set', 'Sade Set', 'Sets', 'Versatile two-piece set with deep tones and soft structure.', 76000, 10, array['S','M','L'], array['Espresso','Burnt Orange'], array[]::text[], array[]::text[], true),
  ('brass-drop-earrings', 'Brass Drop Earrings', 'Accessories', 'Sculptural brass earrings for finishing a Cossirae look.', 32000, 20, array[]::text[], array['Gold','Bronze'], array[]::text[], array[]::text[], false)
on conflict (slug) do update set
  name = excluded.name,
  category = excluded.category,
  description = excluded.description,
  price_ngn = excluded.price_ngn,
  stock_quantity = excluded.stock_quantity,
  sizes = excluded.sizes,
  colours = excluded.colours,
  image_urls = excluded.image_urls,
  video_urls = excluded.video_urls,
  is_featured = excluded.is_featured,
  updated_at = now();
