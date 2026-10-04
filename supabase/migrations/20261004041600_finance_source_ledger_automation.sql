begin;

create or replace function private.finance_append_ledger_line(
  p_lines jsonb,
  p_account_key text,
  p_description text,
  p_debit numeric,
  p_credit numeric
) returns jsonb
language plpgsql
immutable
set search_path=pg_catalog
as $$
declare
  v_debit numeric:=round(coalesce(p_debit,0),2);
  v_credit numeric:=round(coalesce(p_credit,0),2);
begin
  if v_debit=0 and v_credit=0 then return coalesce(p_lines,'[]'::jsonb); end if;
  return coalesce(p_lines,'[]'::jsonb) || jsonb_build_array(jsonb_build_object(
    'accountKey',p_account_key,
    'description',nullif(trim(coalesce(p_description,'')),''),
    'debit',v_debit,
    'credit',v_credit
  ));
end;
$$;

create or replace function private.finance_sync_manual_sale_source(p_sale_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare
  v_sale public.finance_manual_sales;
  v_lines jsonb:='[]'::jsonb;
  v_snapshot jsonb;
  v_asset_key text;
  v_date date;
begin
  select * into v_sale from public.finance_manual_sales where id=p_sale_id;
  if v_sale.id is null then raise exception 'manual sale source not found' using errcode='P0002'; end if;

  v_date:=(v_sale.occurred_at at time zone 'America/Regina')::date;
  v_snapshot:=jsonb_build_object(
    'recognized',v_sale.status='paid','paymentMethod',v_sale.payment_method,
    'subtotal',v_sale.subtotal,'discount',v_sale.discount,'shipping',v_sale.shipping,
    'gstHstTax',v_sale.gst_hst_tax,'pstTax',v_sale.pst_tax,'cogs',v_sale.cogs,'total',v_sale.total,
    'sourceType',coalesce(v_sale.source_type,'manual')
  );

  if v_sale.status='paid' then
    v_asset_key:=case when lower(coalesce(v_sale.payment_method,''))='cash' then 'cash_on_hand' else 'operating_bank' end;
    v_lines:=private.finance_append_ledger_line(v_lines,v_asset_key,'Sale proceeds',v_sale.total,0);
    v_lines:=private.finance_append_ledger_line(v_lines,'discounts_promotions','Discounts and promotions',v_sale.discount,0);
    v_lines:=private.finance_append_ledger_line(v_lines,'merchandise_sales','Merchandise revenue',0,v_sale.subtotal);
    v_lines:=private.finance_append_ledger_line(v_lines,'shipping_revenue','Shipping revenue',0,v_sale.shipping);
    v_lines:=private.finance_append_ledger_line(v_lines,'gst_hst_payable','GST/HST collected',0,v_sale.gst_hst_tax);
    v_lines:=private.finance_append_ledger_line(v_lines,'pst_payable','PST collected',0,v_sale.pst_tax);
    v_lines:=private.finance_append_ledger_line(v_lines,'cost_of_goods_sold','Cost of goods sold',v_sale.cogs,0);
    v_lines:=private.finance_append_ledger_line(v_lines,'inventory','Inventory relieved for sale',0,v_sale.cogs);
  end if;

  return private.finance_source_replace_state(
    'manual_sale',v_sale.id::text,v_snapshot,v_date,
    left(coalesce(v_sale.reference,'Manual sale'),120),
    left(concat('Finance sale · ',coalesce(v_sale.reference,v_sale.id::text)),500),
    v_lines,'Manual sale source state changed'
  );
end;
$$;

create or replace function private.finance_expense_account_key(p_category text)
returns text
language sql
immutable
set search_path=pg_catalog
as $$
  select case lower(trim(coalesce(p_category,'')))
    when 'garments' then 'inventory'
    when 'dtf_transfers' then 'inventory'
    when 'ink' then 'inventory'
    when 'packaging' then 'inventory'
    when 'equipment' then 'equipment'
    when 'advertising' then 'advertising_expense'
    when 'shipping' then 'shipping_delivery_expense'
    when 'local_delivery' then 'shipping_delivery_expense'
    when 'website_hosting' then 'software_hosting_expense'
    when 'domain' then 'software_hosting_expense'
    when 'software' then 'software_hosting_expense'
    when 'supplies' then 'supplies_packaging_expense'
    when 'merchant_fees' then 'merchant_fees'
    else 'misc_operating_expense'
  end;
$$;

create or replace function private.finance_sync_expense_source(p_expense_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare
  v_expense public.finance_expenses;
  v_lines jsonb:='[]'::jsonb;
  v_snapshot jsonb;
  v_target_key text;
  v_payment_key text;
  v_recoverable_gst numeric:=0;
  v_target_debit numeric:=0;
  v_total numeric:=0;
  v_payment_norm text;
begin
  select * into v_expense from public.finance_expenses where id=p_expense_id;
  if v_expense.id is null then raise exception 'expense source not found' using errcode='P0002'; end if;

  v_snapshot:=jsonb_build_object(
    'recognized',v_expense.status='active','occurredOn',v_expense.occurred_on,
    'category',v_expense.category,'amount',v_expense.amount,'tax',v_expense.tax,
    'gstHstTax',v_expense.gst_hst_tax,'pstTax',v_expense.pst_tax,
    'itcEligible',v_expense.gst_hst_itc_eligible,'paymentMethod',v_expense.payment_method,
    'correctionCount',v_expense.correction_count
  );

  if v_expense.status='active' then
    v_target_key:=private.finance_expense_account_key(v_expense.category);
    v_payment_norm:=lower(trim(coalesce(v_expense.payment_method,'')));
    v_payment_key:=case
      when v_payment_norm='cash' then 'cash_on_hand'
      when v_payment_norm in ('credit card','credit_card') then 'other_current_liabilities'
      else 'operating_bank'
    end;
    v_recoverable_gst:=case when v_expense.gst_hst_itc_eligible then coalesce(v_expense.gst_hst_tax,0) else 0 end;
    v_total:=round(coalesce(v_expense.amount,0)+coalesce(v_expense.tax,0),2);
    v_target_debit:=round(v_total-v_recoverable_gst,2);

    v_lines:=private.finance_append_ledger_line(v_lines,v_target_key,
      case when v_target_key='inventory' then 'Direct production purchase' when v_target_key='equipment' then 'Equipment purchase' else 'Operating expense' end,
      v_target_debit,0);
    v_lines:=private.finance_append_ledger_line(v_lines,'gst_hst_payable','GST/HST input tax credit',v_recoverable_gst,0);
    v_lines:=private.finance_append_ledger_line(v_lines,v_payment_key,'Expense payment',0,v_total);
  end if;

  return private.finance_source_replace_state(
    'expense',v_expense.id::text,v_snapshot,v_expense.occurred_on,
    left(coalesce(v_expense.receipt_reference,v_expense.vendor,'Expense'),120),
    left(concat('Finance expense · ',coalesce(v_expense.vendor,'Unknown vendor'),' · ',v_expense.description),500),
    v_lines,'Expense source state changed or was corrected'
  );
end;
$$;

create or replace function private.finance_sync_order_revenue_source(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare
  v_order public.orders;
  v_lines jsonb:='[]'::jsonb;
  v_snapshot jsonb;
  v_recognized boolean:=false;
  v_unclassified_tax numeric:=0;
  v_date date;
begin
  select * into v_order from public.orders where id=p_order_id;
  if v_order.id is null then raise exception 'order source not found' using errcode='P0002'; end if;
  if coalesce(v_order.payment_mode,'live')<>'live' then return jsonb_build_object('skipped',true,'reason','non-live order'); end if;

  v_recognized:=v_order.payment_status in ('paid','refunded','partially_refunded');
  v_snapshot:=jsonb_build_object(
    'recognized',v_recognized,'subtotal',v_order.subtotal,'discount',v_order.discount,
    'shipping',v_order.shipping,'tax',v_order.tax,'gstHstTax',v_order.gst_hst_tax,
    'pstTax',v_order.pst_tax,'total',v_order.total,'paymentMode',v_order.payment_mode
  );
  v_date:=(coalesce(v_order.updated_at,v_order.created_at,now()) at time zone 'America/Regina')::date;

  if v_recognized then
    v_unclassified_tax:=greatest(round(coalesce(v_order.tax,0)-coalesce(v_order.gst_hst_tax,0)-coalesce(v_order.pst_tax,0),2),0);
    v_lines:=private.finance_append_ledger_line(v_lines,'stripe_clearing','Stripe sale proceeds',v_order.total,0);
    v_lines:=private.finance_append_ledger_line(v_lines,'discounts_promotions','Discounts and promotions',v_order.discount,0);
    v_lines:=private.finance_append_ledger_line(v_lines,'merchandise_sales','Merchandise revenue',0,v_order.subtotal);
    v_lines:=private.finance_append_ledger_line(v_lines,'shipping_revenue','Shipping revenue',0,v_order.shipping);
    v_lines:=private.finance_append_ledger_line(v_lines,'gst_hst_payable','GST/HST collected',0,v_order.gst_hst_tax);
    v_lines:=private.finance_append_ledger_line(v_lines,'pst_payable','PST collected',0,v_order.pst_tax);
    v_lines:=private.finance_append_ledger_line(v_lines,'other_current_liabilities','Unclassified sales tax',0,v_unclassified_tax);
  end if;

  return private.finance_source_replace_state(
    'online_order',v_order.id::text,v_snapshot,v_date,
    left(coalesce(v_order.order_number,v_order.id::text),120),
    left(concat('Online order · ',coalesce(v_order.order_number,v_order.id::text)),500),
    v_lines,'Online order payment recognition changed'
  );
end;
$$;

create or replace function private.finance_sync_order_cogs_source(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare
  v_order public.orders;
  v_lines jsonb:='[]'::jsonb;
  v_snapshot jsonb;
  v_recognized boolean:=false;
  v_item_count integer:=0;
  v_configured_count integer:=0;
  v_cogs numeric:=0;
  v_complete boolean:=false;
  v_date date;
begin
  select * into v_order from public.orders where id=p_order_id;
  if v_order.id is null then raise exception 'order source not found' using errcode='P0002'; end if;
  if coalesce(v_order.payment_mode,'live')<>'live' then return jsonb_build_object('skipped',true,'reason','non-live order'); end if;

  v_recognized:=v_order.payment_status in ('paid','refunded','partially_refunded');
  select count(oi.id)::integer,
         count(oi.id) filter (where coalesce(c.is_configured,false))::integer,
         round(coalesce(sum(
           (coalesce(c.garment_unit_cost,0)+coalesce(c.print_unit_cost,0)+coalesce(c.packaging_unit_cost,0)+coalesce(c.other_unit_cost,0))
           * greatest(coalesce(c.quantity_snapshot,oi.quantity,1),1)
         ) filter (where coalesce(c.is_configured,false)),0),2)
  into v_item_count,v_configured_count,v_cogs
  from public.order_items oi
  left join public.finance_order_item_costs c on c.order_item_id=oi.id
  where oi.order_id=p_order_id;

  v_complete:=v_item_count>0 and v_item_count=v_configured_count;
  v_snapshot:=jsonb_build_object(
    'recognized',v_recognized,'complete',v_complete,'itemCount',v_item_count,
    'configuredItemCount',v_configured_count,'cogs',v_cogs
  );
  v_date:=(coalesce(v_order.updated_at,v_order.created_at,now()) at time zone 'America/Regina')::date;

  if v_recognized and v_complete and v_cogs>0 then
    v_lines:=private.finance_append_ledger_line(v_lines,'cost_of_goods_sold','Online order COGS',v_cogs,0);
    v_lines:=private.finance_append_ledger_line(v_lines,'inventory','Inventory relieved for online order',0,v_cogs);
  end if;

  return private.finance_source_replace_state(
    'order_cogs',v_order.id::text,v_snapshot,v_date,
    left(concat(coalesce(v_order.order_number,v_order.id::text),' · COGS'),120),
    left(concat('Order COGS · ',coalesce(v_order.order_number,v_order.id::text)),500),
    v_lines,'Order COGS configuration or payment state changed'
  );
end;
$$;

create or replace function private.finance_sync_refund_source(p_refund_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare
  v_refund public.refunds;
  v_order public.orders;
  v_lines jsonb:='[]'::jsonb;
  v_snapshot jsonb;
  v_recognized boolean:=false;
  v_gst numeric:=0;
  v_pst numeric:=0;
  v_merch numeric:=0;
  v_date date;
begin
  select * into v_refund from public.refunds where id=p_refund_id;
  if v_refund.id is null then raise exception 'refund source not found' using errcode='P0002'; end if;
  select * into v_order from public.orders where id=v_refund.order_id;
  if v_order.id is null or coalesce(v_order.payment_mode,'live')<>'live' then
    return jsonb_build_object('skipped',true,'reason','non-live or missing order');
  end if;

  v_recognized:=lower(coalesce(v_refund.status,'')) in ('processed','completed','succeeded','paid','refunded');
  v_gst:=least(greatest(coalesce(v_refund.amount,0),0),greatest(coalesce(v_refund.gst_hst_tax,0),0));
  v_pst:=least(greatest(coalesce(v_refund.amount,0)-v_gst,0),greatest(coalesce(v_refund.pst_tax,0),0));
  v_merch:=greatest(round(coalesce(v_refund.amount,0)-v_gst-v_pst,2),0);
  v_snapshot:=jsonb_build_object(
    'recognized',v_recognized,'amount',v_refund.amount,'gstHstTax',v_gst,'pstTax',v_pst,
    'providerRefundId',v_refund.provider_refund_id,'orderId',v_refund.order_id
  );
  v_date:=(coalesce(v_refund.processed_at,v_refund.created_at,now()) at time zone 'America/Regina')::date;

  if v_recognized and coalesce(v_refund.amount,0)>0 then
    v_lines:=private.finance_append_ledger_line(v_lines,'sales_returns_refunds','Sales refund before tax',v_merch,0);
    v_lines:=private.finance_append_ledger_line(v_lines,'gst_hst_payable','GST/HST refunded',v_gst,0);
    v_lines:=private.finance_append_ledger_line(v_lines,'pst_payable','PST refunded',v_pst,0);
    v_lines:=private.finance_append_ledger_line(v_lines,'stripe_clearing','Stripe refund',0,v_refund.amount);
  end if;

  return private.finance_source_replace_state(
    'refund',v_refund.id::text,v_snapshot,v_date,
    left(coalesce(v_refund.provider_refund_id,concat('Refund ',v_refund.id::text)),120),
    left(concat('Refund · order ',coalesce(v_order.order_number,v_order.id::text)),500),
    v_lines,'Refund settlement state changed'
  );
end;
$$;

create or replace function private.finance_sync_stripe_fee_source(p_balance_transaction_id text)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare
  v_row public.finance_stripe_balance_transactions;
  v_lines jsonb:='[]'::jsonb;
  v_snapshot jsonb;
  v_fee numeric:=0;
  v_date date;
begin
  select * into v_row from public.finance_stripe_balance_transactions where stripe_balance_transaction_id=p_balance_transaction_id;
  if v_row.stripe_balance_transaction_id is null then raise exception 'Stripe balance transaction source not found' using errcode='P0002'; end if;
  if coalesce(v_row.payment_mode,'live')<>'live' then return jsonb_build_object('skipped',true,'reason','non-live Stripe row'); end if;

  v_fee:=round(coalesce(v_row.fee,0),2);
  v_snapshot:=jsonb_build_object('fee',v_fee,'currency',v_row.currency,'paymentMode',v_row.payment_mode);
  v_date:=(coalesce(v_row.stripe_created_at,v_row.captured_at,now()) at time zone 'America/Regina')::date;
  if v_fee>0 then
    v_lines:=private.finance_append_ledger_line(v_lines,'merchant_fees','Stripe processing fee',v_fee,0);
    v_lines:=private.finance_append_ledger_line(v_lines,'stripe_clearing','Stripe fee withheld',0,v_fee);
  elsif v_fee<0 then
    v_lines:=private.finance_append_ledger_line(v_lines,'stripe_clearing','Stripe fee reversal',abs(v_fee),0);
    v_lines:=private.finance_append_ledger_line(v_lines,'merchant_fees','Stripe fee reversal',0,abs(v_fee));
  end if;

  return private.finance_source_replace_state(
    'stripe_fee',v_row.stripe_balance_transaction_id,v_snapshot,v_date,
    left(concat('Stripe fee · ',v_row.stripe_balance_transaction_id),120),
    left(concat('Stripe fee · ',coalesce(v_row.transaction_type,'transaction')),500),
    v_lines,'Stripe fee settlement changed'
  );
end;
$$;

create or replace function private.finance_sync_stripe_payout_source(p_payout_id text)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare
  v_row public.finance_stripe_payouts;
  v_lines jsonb:='[]'::jsonb;
  v_snapshot jsonb;
  v_recognized boolean:=false;
  v_amount numeric:=0;
  v_date date;
begin
  select * into v_row from public.finance_stripe_payouts where stripe_payout_id=p_payout_id;
  if v_row.stripe_payout_id is null then raise exception 'Stripe payout source not found' using errcode='P0002'; end if;
  if coalesce(v_row.payment_mode,'live')<>'live' then return jsonb_build_object('skipped',true,'reason','non-live Stripe payout'); end if;

  v_recognized:=lower(coalesce(v_row.status,''))='paid';
  v_amount:=round(coalesce(v_row.amount,0),2);
  v_snapshot:=jsonb_build_object('recognized',v_recognized,'amount',v_amount,'currency',v_row.currency,'paymentMode',v_row.payment_mode);
  v_date:=coalesce(v_row.arrival_date,(coalesce(v_row.stripe_created_at,v_row.captured_at,now()) at time zone 'America/Regina')::date);

  if v_recognized and v_amount>0 then
    v_lines:=private.finance_append_ledger_line(v_lines,'operating_bank','Stripe payout received',v_amount,0);
    v_lines:=private.finance_append_ledger_line(v_lines,'stripe_clearing','Stripe clearing payout',0,v_amount);
  elsif v_recognized and v_amount<0 then
    v_lines:=private.finance_append_ledger_line(v_lines,'stripe_clearing','Stripe payout reversal',abs(v_amount),0);
    v_lines:=private.finance_append_ledger_line(v_lines,'operating_bank','Stripe payout reversal',0,abs(v_amount));
  end if;

  return private.finance_source_replace_state(
    'stripe_payout',v_row.stripe_payout_id,v_snapshot,v_date,
    left(concat('Stripe payout · ',v_row.stripe_payout_id),120),
    'Stripe payout settlement',v_lines,'Stripe payout state changed'
  );
end;
$$;

create or replace function private.finance_manual_sale_ledger_trigger()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog
as $$
begin
  begin
    perform private.finance_sync_manual_sale_source(new.id);
  exception when others then
    perform private.finance_record_ledger_failure('manual_sale',new.id::text,'sync',sqlerrm);
  end;
  return new;
end;
$$;

create or replace function private.finance_expense_ledger_trigger()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog
as $$
begin
  begin
    perform private.finance_sync_expense_source(new.id);
  exception when others then
    perform private.finance_record_ledger_failure('expense',new.id::text,'sync',sqlerrm);
  end;
  return new;
end;
$$;

create or replace function private.finance_order_ledger_trigger()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog
as $$
begin
  begin
    perform private.finance_sync_order_revenue_source(new.id);
  exception when others then
    perform private.finance_record_ledger_failure('online_order',new.id::text,'sync',sqlerrm);
  end;
  begin
    perform private.finance_sync_order_cogs_source(new.id);
  exception when others then
    perform private.finance_record_ledger_failure('order_cogs',new.id::text,'sync',sqlerrm);
  end;
  return new;
end;
$$;

create or replace function private.finance_order_cost_ledger_trigger()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog
as $$
begin
  begin
    perform private.finance_sync_order_cogs_source(new.order_id);
  exception when others then
    perform private.finance_record_ledger_failure('order_cogs',new.order_id::text,'sync',sqlerrm);
  end;
  return new;
end;
$$;

create or replace function private.finance_refund_ledger_trigger()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog
as $$
begin
  begin
    perform private.finance_sync_refund_source(new.id);
  exception when others then
    perform private.finance_record_ledger_failure('refund',new.id::text,'sync',sqlerrm);
  end;
  return new;
end;
$$;

create or replace function private.finance_stripe_balance_ledger_trigger()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog
as $$
begin
  begin
    perform private.finance_sync_stripe_fee_source(new.stripe_balance_transaction_id);
  exception when others then
    perform private.finance_record_ledger_failure('stripe_fee',new.stripe_balance_transaction_id,'sync',sqlerrm);
  end;
  return new;
end;
$$;

create or replace function private.finance_stripe_payout_ledger_trigger()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog
as $$
begin
  begin
    perform private.finance_sync_stripe_payout_source(new.stripe_payout_id);
  exception when others then
    perform private.finance_record_ledger_failure('stripe_payout',new.stripe_payout_id,'sync',sqlerrm);
  end;
  return new;
end;
$$;

drop trigger if exists finance_manual_sales_to_ledger on public.finance_manual_sales;
create trigger finance_manual_sales_to_ledger
after insert or update of status,subtotal,discount,shipping,gst_hst_tax,pst_tax,cogs,total,payment_method,occurred_at
on public.finance_manual_sales for each row execute function private.finance_manual_sale_ledger_trigger();

drop trigger if exists finance_expenses_to_ledger on public.finance_expenses;
create trigger finance_expenses_to_ledger
after insert or update of status,occurred_on,category,description,amount,tax,gst_hst_tax,pst_tax,gst_hst_itc_eligible,payment_method
on public.finance_expenses for each row execute function private.finance_expense_ledger_trigger();

drop trigger if exists finance_orders_to_ledger on public.orders;
create trigger finance_orders_to_ledger
after insert or update of payment_status,subtotal,discount,shipping,tax,gst_hst_tax,pst_tax,total,payment_mode
on public.orders for each row execute function private.finance_order_ledger_trigger();

drop trigger if exists finance_order_costs_to_ledger on public.finance_order_item_costs;
create trigger finance_order_costs_to_ledger
after insert or update of quantity_snapshot,garment_unit_cost,print_unit_cost,packaging_unit_cost,other_unit_cost,is_configured
on public.finance_order_item_costs for each row execute function private.finance_order_cost_ledger_trigger();

drop trigger if exists finance_refunds_to_ledger on public.refunds;
create trigger finance_refunds_to_ledger
after insert or update of status,amount,gst_hst_tax,pst_tax,processed_at
on public.refunds for each row execute function private.finance_refund_ledger_trigger();

drop trigger if exists finance_stripe_balance_to_ledger on public.finance_stripe_balance_transactions;
create trigger finance_stripe_balance_to_ledger
after insert or update of fee,payment_mode,stripe_created_at,transaction_type
on public.finance_stripe_balance_transactions for each row execute function private.finance_stripe_balance_ledger_trigger();

drop trigger if exists finance_stripe_payouts_to_ledger on public.finance_stripe_payouts;
create trigger finance_stripe_payouts_to_ledger
after insert or update of amount,status,payment_mode,arrival_date
on public.finance_stripe_payouts for each row execute function private.finance_stripe_payout_ledger_trigger();

create or replace function private.finance_reconcile_source_ledger_impl()
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare
  v_row record;
  v_manual integer:=0;
  v_expenses integer:=0;
  v_orders integer:=0;
  v_refunds integer:=0;
  v_fees integer:=0;
  v_payouts integer:=0;
  v_failures integer:=0;
begin
  for v_row in select id from public.finance_manual_sales loop
    begin perform private.finance_sync_manual_sale_source(v_row.id); v_manual:=v_manual+1;
    exception when others then perform private.finance_record_ledger_failure('manual_sale',v_row.id::text,'sync',sqlerrm); end;
  end loop;

  for v_row in select id from public.finance_expenses loop
    begin perform private.finance_sync_expense_source(v_row.id); v_expenses:=v_expenses+1;
    exception when others then perform private.finance_record_ledger_failure('expense',v_row.id::text,'sync',sqlerrm); end;
  end loop;

  for v_row in select id from public.orders where coalesce(payment_mode,'live')='live' loop
    begin perform private.finance_sync_order_revenue_source(v_row.id);
    exception when others then perform private.finance_record_ledger_failure('online_order',v_row.id::text,'sync',sqlerrm); end;
    begin perform private.finance_sync_order_cogs_source(v_row.id);
    exception when others then perform private.finance_record_ledger_failure('order_cogs',v_row.id::text,'sync',sqlerrm); end;
    v_orders:=v_orders+1;
  end loop;

  for v_row in select r.id from public.refunds r join public.orders o on o.id=r.order_id where coalesce(o.payment_mode,'live')='live' loop
    begin perform private.finance_sync_refund_source(v_row.id); v_refunds:=v_refunds+1;
    exception when others then perform private.finance_record_ledger_failure('refund',v_row.id::text,'sync',sqlerrm); end;
  end loop;

  for v_row in select stripe_balance_transaction_id from public.finance_stripe_balance_transactions where payment_mode='live' loop
    begin perform private.finance_sync_stripe_fee_source(v_row.stripe_balance_transaction_id); v_fees:=v_fees+1;
    exception when others then perform private.finance_record_ledger_failure('stripe_fee',v_row.stripe_balance_transaction_id,'sync',sqlerrm); end;
  end loop;

  for v_row in select stripe_payout_id from public.finance_stripe_payouts where payment_mode='live' loop
    begin perform private.finance_sync_stripe_payout_source(v_row.stripe_payout_id); v_payouts:=v_payouts+1;
    exception when others then perform private.finance_record_ledger_failure('stripe_payout',v_row.stripe_payout_id,'sync',sqlerrm); end;
  end loop;

  select count(*)::integer into v_failures from public.finance_ledger_posting_failures where resolved_at is null;
  return jsonb_build_object(
    'manualSalesChecked',v_manual,'expensesChecked',v_expenses,'ordersChecked',v_orders,
    'refundsChecked',v_refunds,'stripeFeesChecked',v_fees,'stripePayoutsChecked',v_payouts,
    'unresolvedFailures',v_failures,'reconciledAt',now()
  );
end;
$$;

create or replace function public.reconcile_admin_general_ledger_sources()
returns jsonb
language plpgsql
set search_path=pg_catalog
as $$
begin
  if not public.is_admin_step_up_authorized() then
    raise exception 'admin step-up access required' using errcode='42501';
  end if;
  return private.finance_reconcile_source_ledger_impl();
end;
$$;

create or replace function private.finance_get_general_ledger_impl(
  p_from date default null,
  p_to date default null,
  p_limit integer default 300
) returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog
as $$
declare
  v_today date:=(now() at time zone 'America/Regina')::date;
  v_from date:=coalesce(p_from,date_trunc('month',v_today::timestamp)::date);
  v_to date:=coalesce(p_to,v_today);
  v_limit integer:=greatest(25,least(1000,coalesce(p_limit,300)));
  v_result jsonb;
  v_failure_count integer:=0;
  v_pending_cogs integer:=0;
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode='42501'; end if;
  if v_from>v_to then raise exception 'ledger start date must be on or before end date' using errcode='22023'; end if;
  if v_to>v_today then raise exception 'ledger end date cannot be in the future' using errcode='22023'; end if;

  select count(*)::integer into v_failure_count
  from public.finance_ledger_posting_failures where resolved_at is null;

  select count(*)::integer into v_pending_cogs
  from public.orders o
  where coalesce(o.payment_mode,'live')='live'
    and o.payment_status in ('paid','refunded','partially_refunded')
    and exists(
      select 1 from public.order_items oi
      left join public.finance_order_item_costs c on c.order_item_id=oi.id
      where oi.order_id=o.id and not coalesce(c.is_configured,false)
    );

  with scoped_entries as (
    select e.id from public.finance_journal_entries e
    where e.entry_date between v_from and v_to and e.status in ('posted','reversed')
  ), movement as (
    select l.account_id,round(coalesce(sum(l.debit),0),2) debits,round(coalesce(sum(l.credit),0),2) credits
    from public.finance_journal_lines l join scoped_entries e on e.id=l.entry_id
    group by l.account_id
  ), trial_balance as (
    select a.id account_id,a.code,a.name,a.account_type,a.normal_balance,a.system_key,a.active,a.manual_posting_allowed,
      coalesce(m.debits,0)::numeric(16,2) debits,coalesce(m.credits,0)::numeric(16,2) credits,
      round(coalesce(m.debits,0)-coalesce(m.credits,0),2)::numeric(16,2) signed_balance,
      case when coalesce(m.debits,0)-coalesce(m.credits,0)>=0 then round(coalesce(m.debits,0)-coalesce(m.credits,0),2) else 0 end::numeric(16,2) ending_debit,
      case when coalesce(m.credits,0)-coalesce(m.debits,0)>0 then round(coalesce(m.credits,0)-coalesce(m.debits,0),2) else 0 end::numeric(16,2) ending_credit,
      a.sort_order
    from public.finance_accounts a left join movement m on m.account_id=a.id
    where a.active
  ), entry_rows as (
    select e.id,e.entry_number,e.entry_date,e.reference,e.memo,e.source_type,e.status,e.reversal_of_entry_id,e.reversed_by_entry_id,e.reversal_reason,e.created_at,e.posted_at,e.reversed_at,
      coalesce((select round(sum(l.debit),2) from public.finance_journal_lines l where l.entry_id=e.id),0)::numeric(16,2) total_debit,
      coalesce((select round(sum(l.credit),2) from public.finance_journal_lines l where l.entry_id=e.id),0)::numeric(16,2) total_credit,
      coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'lineOrder',l.line_order,'accountId',a.id,'accountCode',a.code,'accountName',a.name,'description',l.description,'debit',l.debit,'credit',l.credit) order by l.line_order)
        from public.finance_journal_lines l join public.finance_accounts a on a.id=l.account_id where l.entry_id=e.id),'[]'::jsonb) lines
    from public.finance_journal_entries e
    where e.entry_date between v_from and v_to
    order by e.entry_date desc,e.entry_number desc
    limit v_limit
  )
  select jsonb_build_object(
    'generatedAt',now(),
    'scope',jsonb_build_object(
      'from',v_from,'to',v_to,'sourceIntegrationComplete',(v_failure_count=0 and v_pending_cogs=0),
      'mode','source_automated'
    ),
    'summary',jsonb_build_object(
      'entryCount',(select count(*) from public.finance_journal_entries e where e.entry_date between v_from and v_to),
      'manualEntryCount',(select count(*) from public.finance_journal_entries e where e.entry_date between v_from and v_to and e.source_type='manual'),
      'sourceEntryCount',(select count(*) from public.finance_journal_entries e where e.entry_date between v_from and v_to and e.source_type='source'),
      'reversalEntryCount',(select count(*) from public.finance_journal_entries e where e.entry_date between v_from and v_to and e.source_type in ('reversal','source_reversal')),
      'sourceReversalEntryCount',(select count(*) from public.finance_journal_entries e where e.entry_date between v_from and v_to and e.source_type='source_reversal'),
      'sourcePostingCount',(select count(*) from public.finance_ledger_source_postings),
      'sourceFailureCount',v_failure_count,
      'pendingCogsOrders',v_pending_cogs,
      'totalDebits',coalesce((select sum(debits) from movement),0),
      'totalCredits',coalesce((select sum(credits) from movement),0),
      'difference',round(coalesce((select sum(debits) from movement),0)-coalesce((select sum(credits) from movement),0),2),
      'balanced',round(coalesce((select sum(debits) from movement),0)-coalesce((select sum(credits) from movement),0),2)=0
    ),
    'sourceAutomation',jsonb_build_object(
      'unresolvedFailures',v_failure_count,
      'pendingCogsOrders',v_pending_cogs,
      'provenanceRows',(select count(*) from public.finance_ledger_source_postings),
      'complete',(v_failure_count=0 and v_pending_cogs=0)
    ),
    'accounts',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'code',a.code,'name',a.name,'accountType',a.account_type,'normalBalance',a.normal_balance,'systemKey',a.system_key,'active',a.active,'manualPostingAllowed',a.manual_posting_allowed,'sortOrder',a.sort_order) order by a.sort_order,a.code) from public.finance_accounts a),'[]'::jsonb),
    'trialBalance',coalesce((select jsonb_agg(to_jsonb(tb)-'sort_order' order by tb.sort_order,tb.code) from trial_balance tb),'[]'::jsonb),
    'entries',coalesce((select jsonb_agg(to_jsonb(er) order by er.entry_date desc,er.entry_number desc) from entry_rows er),'[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.reconcile_admin_general_ledger_sources() from public,anon;
grant execute on function public.reconcile_admin_general_ledger_sources() to authenticated;

revoke all on function private.finance_append_ledger_line(jsonb,text,text,numeric,numeric) from public,anon;
revoke all on function private.finance_expense_account_key(text) from public,anon;
revoke all on function private.finance_sync_manual_sale_source(uuid) from public,anon;
revoke all on function private.finance_sync_expense_source(uuid) from public,anon;
revoke all on function private.finance_sync_order_revenue_source(uuid) from public,anon;
revoke all on function private.finance_sync_order_cogs_source(uuid) from public,anon;
revoke all on function private.finance_sync_refund_source(uuid) from public,anon;
revoke all on function private.finance_sync_stripe_fee_source(text) from public,anon;
revoke all on function private.finance_sync_stripe_payout_source(text) from public,anon;
revoke all on function private.finance_reconcile_source_ledger_impl() from public,anon;

grant execute on function private.finance_append_ledger_line(jsonb,text,text,numeric,numeric) to authenticated,service_role;
grant execute on function private.finance_expense_account_key(text) to authenticated,service_role;
grant execute on function private.finance_sync_manual_sale_source(uuid) to authenticated,service_role;
grant execute on function private.finance_sync_expense_source(uuid) to authenticated,service_role;
grant execute on function private.finance_sync_order_revenue_source(uuid) to authenticated,service_role;
grant execute on function private.finance_sync_order_cogs_source(uuid) to authenticated,service_role;
grant execute on function private.finance_sync_refund_source(uuid) to authenticated,service_role;
grant execute on function private.finance_sync_stripe_fee_source(text) to authenticated,service_role;
grant execute on function private.finance_sync_stripe_payout_source(text) to authenticated,service_role;
grant execute on function private.finance_reconcile_source_ledger_impl() to authenticated,service_role;

commit;
