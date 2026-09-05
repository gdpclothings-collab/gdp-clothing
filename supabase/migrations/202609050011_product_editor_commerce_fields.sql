-- GDP Clothing - richer product editor commerce fields
-- Additive migration to support Shopify-style product administration without changing existing storefront behavior.

begin;

alter table public.products
  add column if not exists sales_channels text[] not null default array['online_store']::text[],
  add column if not exists sell_when_out_of_stock boolean not null default false,
  add column if not exists shipping_package jsonb not null default '{}'::jsonb,
  add column if not exists country_of_origin text,
  add column if not exists hs_code text,
  add column if not exists theme_template text not null default 'default',
  add column if not exists metafields jsonb not null default '{}'::jsonb,
  add column if not exists unit_price jsonb not null default '{}'::jsonb;

alter table public.product_variants
  add column if not exists barcode text;

create index if not exists products_sales_channels_gin_idx
  on public.products using gin (sales_channels);

commit;
