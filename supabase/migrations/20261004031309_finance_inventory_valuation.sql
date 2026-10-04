begin;

create table if not exists public.finance_inventory_cost_events (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid references public.product_variants(id) on delete set null,
  product_name text not null,
  variant_name text,
  sku text,
  previous_variant_cost numeric(12,2),
  previous_effective_cost numeric(12,2),
  new_variant_cost numeric(12,2) not null check (new_variant_cost >= 0),
  reason text not null,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  constraint finance_inventory_cost_events_reason_len check (char_length(reason) between 1 and 500)
);

create index if not exists finance_inventory_cost_events_variant_idx on public.finance_inventory_cost_events(variant_id, changed_at desc);
create index if not exists finance_inventory_cost_events_changed_by_idx on public.finance_inventory_cost_events(changed_by);
create index if not exists finance_inventory_cost_events_changed_at_idx on public.finance_inventory_cost_events(changed_at desc);

alter table public.finance_inventory_cost_events enable row level security;
revoke all on table public.finance_inventory_cost_events from public, anon;
revoke insert, update, delete on table public.finance_inventory_cost_events from authenticated;
grant select on table public.finance_inventory_cost_events to authenticated;
grant all on table public.finance_inventory_cost_events to service_role;

drop policy if exists finance_inventory_cost_events_admin_select on public.finance_inventory_cost_events;
create policy finance_inventory_cost_events_admin_select on public.finance_inventory_cost_events
for select to authenticated using ((select public.is_admin_step_up_authorized()));

create or replace function private.finance_set_inventory_cost_basis_impl(
  p_variant_id uuid,
  p_unit_cost numeric,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare
  v_previous_variant_cost numeric(12,2);
  v_product_cost numeric(12,2);
  v_new_cost numeric(12,2):=round(p_unit_cost,2);
  v_reason text:=nullif(trim(coalesce(p_reason,'')),'');
  v_product_name text;
  v_variant_name text;
  v_sku text;
  v_event public.finance_inventory_cost_events;
begin
  if not public.is_admin_step_up_authorized() then
    raise exception 'admin step-up access required' using errcode='42501';
  end if;
  if p_variant_id is null or p_unit_cost is null or p_unit_cost < 0 or p_unit_cost > 100000 then
    raise exception 'valid inventory unit cost is required' using errcode='22023';
  end if;
  if v_reason is null then
    raise exception 'cost change reason is required' using errcode='22023';
  end if;
  if char_length(v_reason)>500 then
    raise exception 'cost change reason is too long' using errcode='22001';
  end if;

  select pv.cost_per_item, p.cost_per_item, p.name, pv.name, pv.sku
    into v_previous_variant_cost, v_product_cost, v_product_name, v_variant_name, v_sku
  from public.product_variants pv
  join public.products p on p.id=pv.product_id
  where pv.id=p_variant_id
  for update of pv;

  if not found then
    raise exception 'inventory variant not found' using errcode='P0002';
  end if;

  if v_previous_variant_cost is not distinct from v_new_cost then
    raise exception 'new unit cost matches the existing variant cost' using errcode='22023';
  end if;

  update public.product_variants
  set cost_per_item=v_new_cost, updated_at=now()
  where id=p_variant_id;

  insert into public.finance_inventory_cost_events(
    variant_id,product_name,variant_name,sku,previous_variant_cost,previous_effective_cost,new_variant_cost,reason,changed_by,changed_at
  ) values (
    p_variant_id,v_product_name,v_variant_name,v_sku,v_previous_variant_cost,coalesce(v_previous_variant_cost,v_product_cost),v_new_cost,v_reason,auth.uid(),now()
  ) returning * into v_event;

  return jsonb_build_object(
    'event',to_jsonb(v_event),
    'variantId',p_variant_id,
    'previousVariantCost',v_previous_variant_cost,
    'previousEffectiveCost',coalesce(v_previous_variant_cost,v_product_cost),
    'newVariantCost',v_new_cost
  );
end;
$$;

create or replace function private.finance_get_inventory_valuation_impl(p_limit integer default 1000)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog
as $$
declare
  v_limit integer:=greatest(50,least(2000,coalesce(p_limit,1000)));
  v_result jsonb;
begin
  if not public.is_admin_step_up_authorized() then
    raise exception 'admin step-up access required' using errcode='42501';
  end if;

  with variant_rows as (
    select
      pv.id variant_id,
      pv.product_id,
      p.name product_name,
      pv.name variant_name,
      pv.sku,
      pv.color,
      pv.size,
      pv.active variant_active,
      p.status product_status,
      pv.cost_per_item variant_cost,
      p.cost_per_item product_cost,
      coalesce(pv.cost_per_item,p.cost_per_item) effective_cost,
      case when pv.cost_per_item is not null then 'variant' when p.cost_per_item is not null then 'product' else 'missing' end cost_source,
      coalesce(sum(il.available),0)::integer available_units,
      coalesce(sum(il.committed),0)::integer committed_units,
      coalesce(sum(il.available+il.committed),0)::integer on_hand_units,
      coalesce(sum(il.incoming),0)::integer incoming_units,
      case when coalesce(pv.cost_per_item,p.cost_per_item) is null then null
           else round(coalesce(sum(il.available+il.committed),0)*coalesce(pv.cost_per_item,p.cost_per_item),2) end known_value,
      coalesce(jsonb_agg(jsonb_build_object(
        'locationId',l.id,'locationCode',l.code,'locationName',l.name,
        'available',il.available,'committed',il.committed,'onHand',il.available+il.committed,'incoming',il.incoming
      ) order by l.sort_order,l.name) filter (where il.id is not null),'[]'::jsonb) locations
    from public.product_variants pv
    join public.products p on p.id=pv.product_id
    left join public.inventory_levels il on il.variant_id=pv.id
    left join public.inventory_locations l on l.id=il.location_id
    group by pv.id,pv.product_id,p.name,pv.name,pv.sku,pv.color,pv.size,pv.active,p.status,pv.cost_per_item,p.cost_per_item
    having coalesce(sum(il.available+il.committed),0)<>0 or coalesce(sum(il.incoming),0)<>0
  ), location_rows as (
    select
      l.id location_id,
      l.code location_code,
      l.name location_name,
      l.active,
      l.is_default,
      coalesce(sum(il.available),0)::integer available_units,
      coalesce(sum(il.committed),0)::integer committed_units,
      coalesce(sum(il.available+il.committed),0)::integer on_hand_units,
      coalesce(sum(il.incoming),0)::integer incoming_units,
      coalesce(sum(case when coalesce(pv.cost_per_item,p.cost_per_item) is not null then il.available+il.committed else 0 end),0)::integer costed_units,
      coalesce(sum(case when coalesce(pv.cost_per_item,p.cost_per_item) is null then il.available+il.committed else 0 end),0)::integer uncosted_units,
      round(coalesce(sum((il.available+il.committed)*coalesce(pv.cost_per_item,p.cost_per_item,0)),0),2) known_value
    from public.inventory_locations l
    left join public.inventory_levels il on il.location_id=l.id
    left join public.product_variants pv on pv.id=il.variant_id
    left join public.products p on p.id=pv.product_id
    group by l.id,l.code,l.name,l.active,l.is_default
    having coalesce(sum(il.available+il.committed),0)<>0 or coalesce(sum(il.incoming),0)<>0
  ), summary as (
    select
      coalesce(sum(on_hand_units),0)::integer on_hand_units,
      coalesce(sum(incoming_units),0)::integer incoming_units,
      coalesce(sum(case when effective_cost is not null then on_hand_units else 0 end),0)::integer costed_units,
      coalesce(sum(case when effective_cost is null then on_hand_units else 0 end),0)::integer uncosted_units,
      coalesce(sum(known_value),0)::numeric(14,2) known_value,
      count(*) filter (where on_hand_units<>0)::integer stocked_variants,
      count(*) filter (where on_hand_units<>0 and effective_cost is null)::integer uncosted_variants,
      count(*) filter (where on_hand_units<0)::integer negative_variants
    from variant_rows
  )
  select jsonb_build_object(
    'generatedAt',now(),
    'summary',jsonb_build_object(
      'onHandUnits',s.on_hand_units,
      'incomingUnits',s.incoming_units,
      'costedUnits',s.costed_units,
      'uncostedUnits',s.uncosted_units,
      'knownValue',s.known_value,
      'inventoryValue',case when s.uncosted_units=0 and s.negative_variants=0 then s.known_value else null end,
      'valuationComplete',(s.uncosted_units=0 and s.negative_variants=0),
      'coveragePercent',case when s.on_hand_units=0 then 100 else round((s.costed_units::numeric/nullif(s.on_hand_units,0))*100,1) end,
      'stockedVariants',s.stocked_variants,
      'uncostedVariants',s.uncosted_variants,
      'negativeVariants',s.negative_variants
    ),
    'variants',coalesce((select jsonb_agg(to_jsonb(v) order by (v.effective_cost is null) desc,v.product_name,v.variant_name,v.sku) from (select * from variant_rows order by (effective_cost is null) desc,product_name,variant_name,sku limit v_limit) v),'[]'::jsonb),
    'locations',coalesce((select jsonb_agg(to_jsonb(lr) order by lr.is_default desc,lr.location_name) from location_rows lr),'[]'::jsonb),
    'costEvents',coalesce((select jsonb_agg(to_jsonb(e) order by e.changed_at desc) from (select id,variant_id,product_name,variant_name,sku,previous_variant_cost,previous_effective_cost,new_variant_cost,reason,changed_at from public.finance_inventory_cost_events order by changed_at desc limit 100) e),'[]'::jsonb)
  ) into v_result
  from summary s;

  return v_result;
end;
$$;

revoke all on function private.finance_set_inventory_cost_basis_impl(uuid,numeric,text) from public,anon;
revoke all on function private.finance_get_inventory_valuation_impl(integer) from public,anon;
grant execute on function private.finance_set_inventory_cost_basis_impl(uuid,numeric,text) to authenticated,service_role;
grant execute on function private.finance_get_inventory_valuation_impl(integer) to authenticated,service_role;

create or replace function public.set_admin_inventory_cost_basis(p_variant_id uuid,p_unit_cost numeric,p_reason text)
returns jsonb language sql security invoker set search_path=pg_catalog as $$
  select private.finance_set_inventory_cost_basis_impl(p_variant_id,p_unit_cost,p_reason);
$$;

create or replace function public.get_admin_inventory_valuation(p_limit integer default 1000)
returns jsonb language sql stable security invoker set search_path=pg_catalog as $$
  select private.finance_get_inventory_valuation_impl(p_limit);
$$;

revoke all on function public.set_admin_inventory_cost_basis(uuid,numeric,text) from public,anon;
revoke all on function public.get_admin_inventory_valuation(integer) from public,anon;
grant execute on function public.set_admin_inventory_cost_basis(uuid,numeric,text) to authenticated,service_role;
grant execute on function public.get_admin_inventory_valuation(integer) to authenticated,service_role;

commit;