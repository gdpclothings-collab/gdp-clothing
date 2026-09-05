-- Centralize GDP Clothing checkout tax and shipping configuration.
-- Conservative Canada model:
--   * GST/HST follows current federal place-of-supply rates.
--   * Saskatchewan includes the 6% Saskatchewan PST because GDP Clothing is based there.
--   * Other non-HST provincial sales taxes remain intentionally unconfigured until registration is confirmed.

do $$
declare
  canada_market uuid;
  default_profile uuid;
begin
  select id into canada_market
  from public.markets
  where code = 'CA' and active = true
  order by is_primary desc, created_at asc
  limit 1;

  if canada_market is null then
    insert into public.markets (code, name, countries, currency, language, active, is_primary)
    values ('CA', 'Canada', array['CA']::text[], 'CAD', 'en', true, true)
    returning id into canada_market;
  end if;

  insert into public.shipping_profiles (name, description, active, product_scope)
  select
    'Canada Standard',
    'Default GDP Clothing Canadian shipping profile.',
    true,
    'all'
  where not exists (
    select 1 from public.shipping_profiles where name = 'Canada Standard'
  );

  select id into default_profile
  from public.shipping_profiles
  where name = 'Canada Standard'
  order by created_at asc
  limit 1;

  insert into public.shipping_rates (
    profile_id, market_id, name, method_code, price,
    min_order, max_order, min_delivery_days, max_delivery_days,
    active, conditions
  )
  select
    default_profile, canada_market, 'Standard Shipping', 'standard', 12.99,
    0, 149.99, 3, 7,
    true, '{"source":"GDP configured checkout rule"}'::jsonb
  where not exists (
    select 1 from public.shipping_rates
    where profile_id = default_profile
      and method_code = 'standard'
      and name = 'Standard Shipping'
  );

  insert into public.shipping_rates (
    profile_id, market_id, name, method_code, price,
    min_order, max_order, min_delivery_days, max_delivery_days,
    active, conditions
  )
  select
    default_profile, canada_market, 'Free Standard Shipping', 'standard', 0,
    150, null, 3, 7,
    true, '{"source":"GDP configured checkout rule"}'::jsonb
  where not exists (
    select 1 from public.shipping_rates
    where profile_id = default_profile
      and method_code = 'standard'
      and name = 'Free Standard Shipping'
  );

  -- Canada default: GST only for non-participating provinces unless a more specific rule exists.
  insert into public.tax_rules (
    market_id, country_code, region_code, name, rate,
    tax_shipping, active, priority, config
  )
  select
    canada_market, 'CA', null, 'Canada GST', 0.05,
    true, true, 200,
    '{"scope":"GST/HST base","source":"Canada Revenue Agency"}'::jsonb
  where not exists (
    select 1 from public.tax_rules
    where country_code = 'CA' and region_code is null and name = 'Canada GST'
  );

  -- Saskatchewan: 5% GST + 6% Saskatchewan PST.
  insert into public.tax_rules (
    market_id, country_code, region_code, name, rate,
    tax_shipping, active, priority, config
  )
  select
    canada_market, 'CA', 'SK', 'Saskatchewan GST + PST', 0.11,
    true, true, 10,
    '{"scope":"5% GST + 6% Saskatchewan PST","source":"Canada Revenue Agency"}'::jsonb
  where not exists (
    select 1 from public.tax_rules where country_code = 'CA' and region_code = 'SK'
  );

  insert into public.tax_rules (market_id, country_code, region_code, name, rate, tax_shipping, active, priority, config)
  select canada_market, 'CA', 'ON', 'Ontario HST', 0.13, true, true, 10, '{"scope":"HST","source":"Canada Revenue Agency"}'::jsonb
  where not exists (select 1 from public.tax_rules where country_code='CA' and region_code='ON');

  insert into public.tax_rules (market_id, country_code, region_code, name, rate, tax_shipping, active, priority, config)
  select canada_market, 'CA', 'NS', 'Nova Scotia HST', 0.14, true, true, 10, '{"scope":"HST","source":"Canada Revenue Agency"}'::jsonb
  where not exists (select 1 from public.tax_rules where country_code='CA' and region_code='NS');

  insert into public.tax_rules (market_id, country_code, region_code, name, rate, tax_shipping, active, priority, config)
  select canada_market, 'CA', 'NB', 'New Brunswick HST', 0.15, true, true, 10, '{"scope":"HST","source":"Canada Revenue Agency"}'::jsonb
  where not exists (select 1 from public.tax_rules where country_code='CA' and region_code='NB');

  insert into public.tax_rules (market_id, country_code, region_code, name, rate, tax_shipping, active, priority, config)
  select canada_market, 'CA', 'NL', 'Newfoundland and Labrador HST', 0.15, true, true, 10, '{"scope":"HST","source":"Canada Revenue Agency"}'::jsonb
  where not exists (select 1 from public.tax_rules where country_code='CA' and region_code='NL');

  insert into public.tax_rules (market_id, country_code, region_code, name, rate, tax_shipping, active, priority, config)
  select canada_market, 'CA', 'PE', 'Prince Edward Island HST', 0.15, true, true, 10, '{"scope":"HST","source":"Canada Revenue Agency"}'::jsonb
  where not exists (select 1 from public.tax_rules where country_code='CA' and region_code='PE');
end
$$;
