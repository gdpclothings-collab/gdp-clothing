-- Atomic administration of manual draft orders. Never affects checkout or payments.
create or replace function public.save_admin_draft_atomic(p_id uuid, p_order jsonb, p_items jsonb)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid; v_row public.orders%rowtype; v_item jsonb; v_sum numeric := 0; v_count integer := 0;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Administrator required'; end if;
 if jsonb_typeof(p_order) <> 'object' or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Valid order and items required'; end if;
 if nullif(trim(p_order->>'customer_email'),'') is null then raise exception 'Customer email required'; end if;
 for v_item in select value from jsonb_array_elements(p_items)
 loop
   if nullif(trim(v_item->>'name'),'') is null
     or (v_item->>'quantity')::numeric <= 0
     or (v_item->>'quantity')::numeric <> trunc((v_item->>'quantity')::numeric)
     or (v_item->>'unit_price')::numeric < 0 then raise exception 'Invalid item'; end if;
   v_sum := v_sum + round((v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric, 2);
   v_count := v_count+1;
 end loop;
 if round(v_sum,2) <> (p_order->>'subtotal')::numeric then raise exception 'Subtotal mismatch'; end if;
 if abs(coalesce((p_order->>'gst_hst_tax')::numeric,0)+coalesce((p_order->>'pst_tax')::numeric,0)-coalesce((p_order->>'tax')::numeric,0)) > .009 then raise exception 'Tax mismatch'; end if;
 if abs((p_order->>'subtotal')::numeric - (p_order->>'discount')::numeric + (p_order->>'shipping')::numeric + (p_order->>'tax')::numeric - (p_order->>'total')::numeric) > .009 then raise exception 'Order total mismatch'; end if;
 if p_id is not null then
   select * into v_row from public.orders where id=p_id for update;
   if not found or v_row.status <> 'draft' then raise exception 'Only existing drafts can be updated'; end if;
   if exists (select 1 from public.gdp_invoices where order_id=p_id) then raise exception 'Issued invoice cannot be changed'; end if;
   v_id:=p_id;
   update public.orders set customer_email=p_order->>'customer_email', customer_name=p_order->>'customer_name',
     customer_phone=p_order->>'customer_phone', subtotal=(p_order->>'subtotal')::numeric,
     discount=(p_order->>'discount')::numeric, shipping=(p_order->>'shipping')::numeric,
     tax=(p_order->>'tax')::numeric, gst_hst_tax=(p_order->>'gst_hst_tax')::numeric,
     pst_tax=(p_order->>'pst_tax')::numeric, total=(p_order->>'total')::numeric,
     shipping_address=coalesce(p_order->'shipping_address','{}'::jsonb),
     billing_address=coalesce(p_order->'billing_address','{}'::jsonb),
     shipping_method=p_order->>'shipping_method', notes=p_order->>'notes',
     invoice_due_date=nullif(p_order->>'invoice_due_date','')::date,
     invoice_payment_terms=p_order->>'invoice_payment_terms',
     need_by_date=nullif(p_order->>'need_by_date','')::date, priority=coalesce(p_order->>'priority','standard')
   where id=v_id;
   delete from public.order_items where order_id=v_id;
 else
   insert into public.orders(order_number,customer_email,customer_name,customer_phone,subtotal,discount,shipping,tax,gst_hst_tax,pst_tax,total,status,fulfillment_status,payment_status,shipping_address,billing_address,shipping_method,notes,invoice_due_date,invoice_payment_terms,is_guest,need_by_date,priority)
   values ('GDP-DRAFT-'||substr(replace(gen_random_uuid()::text,'-',''),1,16),p_order->>'customer_email',p_order->>'customer_name',p_order->>'customer_phone',
   (p_order->>'subtotal')::numeric,(p_order->>'discount')::numeric,(p_order->>'shipping')::numeric,(p_order->>'tax')::numeric,
   (p_order->>'gst_hst_tax')::numeric,(p_order->>'pst_tax')::numeric,(p_order->>'total')::numeric,
   'draft','draft','pending',coalesce(p_order->'shipping_address','{}'::jsonb),coalesce(p_order->'billing_address','{}'::jsonb),
   p_order->>'shipping_method',p_order->>'notes',nullif(p_order->>'invoice_due_date','')::date,
   p_order->>'invoice_payment_terms',true,nullif(p_order->>'need_by_date','')::date,coalesce(p_order->>'priority','standard'))
   returning id into v_id;
 end if;
 insert into public.order_items(order_id,product_id,variant_id,name,image,variant,size,color,quantity,unit_price,fulfillment_mode,is_custom)
 select v_id,nullif(x->>'product_id','')::uuid,nullif(x->>'variant_id','')::uuid,x->>'name',x->>'image',
   x->>'variant',x->>'size',x->>'color',(x->>'quantity')::integer,(x->>'unit_price')::numeric,
   coalesce(x->>'fulfillment_mode','in_house'),false
 from jsonb_array_elements(p_items) x;
 return v_id;
end $$;
revoke all on function public.save_admin_draft_atomic(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.save_admin_draft_atomic(uuid,jsonb,jsonb) to authenticated;

create or replace function public.activate_admin_draft_atomic(p_id uuid)
returns public.orders language plpgsql security definer set search_path = '' as $$
declare v_order public.orders%rowtype; v_sum numeric;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Administrator required'; end if;
 select * into v_order from public.orders where id=p_id for update;
 if not found or v_order.status <> 'draft' then raise exception 'Draft not found'; end if;
 select sum(quantity*unit_price) into v_sum from public.order_items where order_id=p_id;
 if v_sum is null or abs(v_sum-v_order.subtotal)>.01 then raise exception 'Draft items missing or subtotal inconsistent'; end if;
 if abs(coalesce(v_order.gst_hst_tax,0)+coalesce(v_order.pst_tax,0)-coalesce(v_order.tax,0))>.01 then raise exception 'Tax allocation inconsistent'; end if;
 if abs(v_order.subtotal-v_order.discount+v_order.shipping+v_order.tax-v_order.total)>.01 then raise exception 'Draft total inconsistent'; end if;
 update public.orders set status='pending_payment',fulfillment_status='pending_payment',payment_status='pending'
 where id=p_id returning * into v_order;
 return v_order;
end $$;
revoke all on function public.activate_admin_draft_atomic(uuid) from public,anon;
grant execute on function public.activate_admin_draft_atomic(uuid) to authenticated;
