alter table public.orders
  alter column payment_method set default 'monnify';

drop policy if exists "Public can create orders" on public.orders;
drop policy if exists "Public can create order items" on public.order_items;
