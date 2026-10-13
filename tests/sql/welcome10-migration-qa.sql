-- Test WELCOME10 migration against synthetic production-shaped tables.
do $$ begin
  if (select active from public.discounts where code='WELCOME10') then
    raise exception 'WELCOME10 must be inactive immediately after migration';
  end if;
  if has_function_privilege('anon','public.reserve_welcome10_coupon(uuid,uuid,timestamptz,text)','EXECUTE')
     or has_function_privilege('authenticated','public.redeem_welcome10_coupon(uuid,timestamptz)','EXECUTE')
     or not has_function_privilege('service_role','public.reserve_welcome10_coupon(uuid,uuid,timestamptz,text)','EXECUTE') then
    raise exception 'WELCOME10 RPC permission guard failed';
  end if;
end $$;

update public.discounts set active=true where code='WELCOME10';
insert into public.orders(id,user_id,customer_email,discount_code,payment_status,payment_mode,subtotal,discount)
values
 ('00000000-0000-4000-8000-000000000001',null,'first@example.com','WELCOME10','pending','test',100,10),
 ('00000000-0000-4000-8000-000000000002',null,'first@example.com','WELCOME10','pending','test',100,10),
 ('00000000-0000-4000-8000-000000000003',null,'legacy@example.com','SAVE5','pending','test',100,5),
 ('00000000-0000-4000-8000-000000000004',null,'had-order@example.com','SAVE5','paid','test',100,5),
 ('00000000-0000-4000-8000-000000000005',null,'had-order@example.com','WELCOME10','pending','test',100,10);

do $$ declare v_w uuid; v_old uuid; v_result jsonb; begin
 select id into v_w from public.discounts where code='WELCOME10';
 select id into v_old from public.discounts where code='SAVE5';
 v_result:=public.reserve_welcome10_coupon(
   '00000000-0000-4000-8000-000000000001',v_w,now()+interval '30 minutes','first@example.com');
 if v_result->>'reserved'<>'true' then raise exception 'new reservation failed'; end if;
 v_result:=public.reserve_welcome10_coupon(
   '00000000-0000-4000-8000-000000000001',v_w,now()+interval '30 minutes','first@example.com');
 if v_result->>'existing'<>'true' then raise exception 'reservation replay not idempotent'; end if;
 begin
  perform public.reserve_welcome10_coupon(
   '00000000-0000-4000-8000-000000000002',v_w,now()+interval '30 minutes','first@example.com');
  raise exception 'expected second hold rejection';
 exception when others then
  if sqlerrm not like '%WELCOME_ALREADY_RESERVED%' then raise; end if;
 end;
 begin
  perform public.reserve_welcome10_coupon(
   '00000000-0000-4000-8000-000000000005',v_w,now()+interval '30 minutes','had-order@example.com');
  raise exception 'expected prior paid order rejection';
 exception when others then
  if sqlerrm not like '%WELCOME_PREVIOUS_PAID_ORDER%' then raise; end if;
 end;
 begin
  perform public.reserve_order_coupon('00000000-0000-4000-8000-000000000002',v_w,now()+interval '30 minutes');
  raise exception 'expected legacy WELCOME10 reservation bypass rejection';
 exception when others then
  if sqlerrm not like '%WELCOME10_DEDICATED_RPC_REQUIRED%' then raise; end if;
 end;
 v_result:=public.reserve_order_coupon('00000000-0000-4000-8000-000000000003',v_old,now()+interval '30 minutes');
 if v_result->>'reserved'<>'true' then raise exception 'ordinary coupon reserve regression'; end if;
end $$;
update public.orders set payment_status='paid', stripe_checkout_session_id='cs_local_1',
 stripe_payment_intent_id='pi_local_1'
where id='00000000-0000-4000-8000-000000000001';

do $$ declare r jsonb; begin
 r:=public.redeem_welcome10_coupon('00000000-0000-4000-8000-000000000001',now());
 if r->>'redeemed'<>'true' or r->>'existing'<>'false' then raise exception 'redeem failed'; end if;
 r:=public.redeem_welcome10_coupon('00000000-0000-4000-8000-000000000001',now());
 if r->>'redeemed'<>'true' or r->>'existing'<>'true' then raise exception 'redemption replay failed'; end if;
 if (select usage_count from public.discounts where code='WELCOME10')<>1 then
   raise exception 'duplicate WELCOME10 counted more than once'; end if;
 if (select count(*) from public.coupon_redemptions where order_id='00000000-0000-4000-8000-000000000001')<>1 then
   raise exception 'duplicate coupon redemption row'; end if;
 begin
   perform public.redeem_order_coupon('00000000-0000-4000-8000-000000000001');
   raise exception 'expected legacy WELCOME10 redemption bypass rejection';
 exception when others then
   if sqlerrm not like '%WELCOME10_DEDICATED_RPC_REQUIRED%' then raise; end if;
 end;
 r:=public.redeem_order_coupon('00000000-0000-4000-8000-000000000003');
 if r->>'redeemed'<>'true' then raise exception 'ordinary coupon redeem regression'; end if;
end $$;
select public.record_welcome10_reconciliation(
 '00000000-0000-4000-8000-000000000001','evt_a','pi_local_1','test','synthetic_replay');
select public.record_welcome10_reconciliation(
 '00000000-0000-4000-8000-000000000001','evt_b','pi_local_1','test','synthetic_replay');
do $$ begin
 if (select count(*) from public.welcome10_reconciliation where order_id='00000000-0000-4000-8000-000000000001')<>1
    or (select attempt_count from public.welcome10_reconciliation where order_id='00000000-0000-4000-8000-000000000001')<>2
 then raise exception 'reconciliation retry coalescing failed'; end if;
 if not public.resolve_welcome10_reconciliation('00000000-0000-4000-8000-000000000001','pi_local_1') then
   raise exception 'pending reconciliation resolution failed'; end if;
end $$;
select 'PASS: actual WELCOME10 SQL migration synthetic regression' as result;
