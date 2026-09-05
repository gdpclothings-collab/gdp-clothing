begin;

alter table public.orders
  add column if not exists confirmation_token uuid not null default gen_random_uuid();

create unique index if not exists orders_confirmation_token_uidx
  on public.orders(confirmation_token);

commit;
