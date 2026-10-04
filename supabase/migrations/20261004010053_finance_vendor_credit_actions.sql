create or replace function private.finance_create_vendor_credit_impl(
  p_issue_date date,
  p_vendor text,
  p_credit_number text,
  p_description text,
  p_amount numeric,
  p_gst_hst_tax numeric default 0,
  p_pst_tax numeric default 0,
  p_supplier_id uuid default null,
  p_purchase_order_id uuid default null,
  p_notes text default null
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
  v_row public.finance_vendor_credits;
  v_po public.finance_purchase_orders;
  v_supplier public.finance_suppliers;
  v_vendor text:=nullif(trim(coalesce(p_vendor,'')),'');
  v_credit_number text:=nullif(trim(coalesce(p_credit_number,'')),'');
  v_description text:=nullif(trim(coalesce(p_description,'')),'');
  v_notes text:=nullif(trim(coalesce(p_notes,'')),'');
  v_amount numeric:=round(coalesce(p_amount,0),2);
  v_gst numeric:=round(coalesce(p_gst_hst_tax,0),2);
  v_pst numeric:=round(coalesce(p_pst_tax,0),2);
  v_supplier_id uuid:=p_supplier_id;
  v_today date:=(now() at time zone 'America/Regina')::date;
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode='42501'; end if;
  if p_issue_date is null or p_issue_date>v_today then raise exception 'valid credit issue date is required' using errcode='22023'; end if;
  if v_description is null then raise exception 'credit description is required' using errcode='22023'; end if;
  if v_amount<0 or v_gst<0 or v_pst<0 or round(v_amount+v_gst+v_pst,2)<=0 then raise exception 'vendor credit total must be greater than zero' using errcode='22023'; end if;

  if p_purchase_order_id is not null then
    select * into v_po from public.finance_purchase_orders where id=p_purchase_order_id for update;
    if v_po.id is null then raise exception 'purchase order not found' using errcode='P0002'; end if;
    if v_po.status<>'approved' then raise exception 'reopen the purchase order before recording a linked vendor credit' using errcode='22023'; end if;
    if p_issue_date<v_po.order_date then raise exception 'credit issue date cannot be before purchase order date' using errcode='22023'; end if;
    if v_supplier_id is not null and v_supplier_id<>v_po.supplier_id then raise exception 'credit supplier does not match purchase order supplier' using errcode='22023'; end if;
    v_supplier_id:=v_po.supplier_id;
    select * into v_supplier from public.finance_suppliers where id=v_supplier_id;
    if v_supplier.id is null then raise exception 'supplier not found' using errcode='P0002'; end if;
    v_vendor:=v_supplier.name;
  elsif v_supplier_id is not null then
    select * into v_supplier from public.finance_suppliers where id=v_supplier_id;
    if v_supplier.id is null then raise exception 'supplier not found' using errcode='P0002'; end if;
    if v_supplier.status<>'active' then raise exception 'supplier must be active for a new vendor credit' using errcode='22023'; end if;
    v_vendor:=v_supplier.name;
  end if;

  if v_vendor is null then raise exception 'vendor is required' using errcode='22023'; end if;
  if char_length(v_vendor)>200 or char_length(coalesce(v_credit_number,''))>120 or char_length(v_description)>500 or char_length(coalesce(v_notes,''))>1000 then raise exception 'one or more credit fields are too long' using errcode='22001'; end if;
  if v_credit_number is null then v_credit_number:='VC-'||to_char(v_today,'YYYYMMDD')||'-'||lpad(nextval('public.finance_vendor_credit_seq'::regclass)::text,5,'0'); end if;

  insert into public.finance_vendor_credits(credit_number,issue_date,vendor,supplier_id,purchase_order_id,source_type,description,amount,gst_hst_tax,pst_tax,currency,status,notes,created_by,created_at,updated_at)
  values(v_credit_number,p_issue_date,v_vendor,v_supplier_id,p_purchase_order_id,'manual',v_description,v_amount,v_gst,v_pst,'CAD','open',v_notes,auth.uid(),now(),now()) returning * into v_row;
  insert into public.finance_vendor_credit_events(credit_id,event_type,after_snapshot,created_by) values(v_row.id,'created',to_jsonb(v_row),auth.uid());
  if p_purchase_order_id is not null then
    insert into public.finance_purchase_order_events(purchase_order_id,event_type,reason,after_snapshot,created_by)
    values(p_purchase_order_id,'vendor_credit_linked',v_credit_number,jsonb_build_object('creditId',v_row.id,'creditNumber',v_credit_number,'total',round(v_amount+v_gst+v_pst,2)),auth.uid());
  end if;
  return to_jsonb(v_row);
exception when unique_violation then raise exception 'this vendor credit number is already recorded' using errcode='23505';
end; $$;

create or replace function private.finance_void_vendor_credit_impl(p_credit_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
  v_before public.finance_vendor_credits;
  v_after public.finance_vendor_credits;
  v_reason text:=nullif(trim(coalesce(p_reason,'')),'');
  v_po_status text;
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode='42501'; end if;
  if p_credit_id is null or v_reason is null then raise exception 'credit and void reason are required' using errcode='22023'; end if;
  if char_length(v_reason)>500 then raise exception 'void reason is too long' using errcode='22001'; end if;
  select * into v_before from public.finance_vendor_credits where id=p_credit_id for update;
  if v_before.id is null then raise exception 'vendor credit not found' using errcode='P0002'; end if;
  if v_before.status<>'open' then raise exception 'only an unused open credit can be voided' using errcode='22023'; end if;
  if v_before.source_type<>'manual' then raise exception 'reverse the purchase return instead of voiding its generated credit' using errcode='22023'; end if;
  if exists(select 1 from public.finance_vendor_credit_applications where credit_id=p_credit_id and status='active') then raise exception 'reverse active credit applications before voiding this credit' using errcode='22023'; end if;
  if v_before.purchase_order_id is not null then
    select status into v_po_status from public.finance_purchase_orders where id=v_before.purchase_order_id for update;
    if v_po_status='closed' then raise exception 'reopen the closed purchase order before voiding its linked credit' using errcode='22023'; end if;
  end if;
  update public.finance_vendor_credits set status='voided',voided_at=now(),voided_by=auth.uid(),void_reason=v_reason,updated_at=now() where id=p_credit_id returning * into v_after;
  insert into public.finance_vendor_credit_events(credit_id,event_type,reason,before_snapshot,after_snapshot,created_by) values(p_credit_id,'voided',v_reason,to_jsonb(v_before),to_jsonb(v_after),auth.uid());
  return to_jsonb(v_after);
end; $$;

create or replace function private.finance_apply_vendor_credit_impl(p_credit_id uuid,p_bill_id uuid,p_note text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
  v_credit public.finance_vendor_credits;
  v_bill public.finance_vendor_bills;
  v_app public.finance_vendor_credit_applications;
  v_note text:=nullif(trim(coalesce(p_note,'')),'');
  v_ca numeric:=0; v_cg numeric:=0; v_cp numeric:=0;
  v_ba numeric:=0; v_bg numeric:=0; v_bp numeric:=0;
  v_avail_a numeric; v_avail_g numeric; v_avail_p numeric;
  v_due_a numeric; v_due_g numeric; v_due_p numeric;
  v_apply_a numeric; v_apply_g numeric; v_apply_p numeric;
  v_credit_remain numeric; v_bill_remain numeric;
  v_po_status text;
  v_after_credit public.finance_vendor_credits;
  v_after_bill public.finance_vendor_bills;
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode='42501'; end if;
  if p_credit_id is null or p_bill_id is null then raise exception 'credit and bill are required' using errcode='22023'; end if;
  if char_length(coalesce(v_note,''))>500 then raise exception 'application note is too long' using errcode='22001'; end if;
  select * into v_credit from public.finance_vendor_credits where id=p_credit_id for update;
  if v_credit.id is null then raise exception 'vendor credit not found' using errcode='P0002'; end if;
  if v_credit.status<>'open' then raise exception 'only an open vendor credit with remaining value can be applied' using errcode='22023'; end if;
  select * into v_bill from public.finance_vendor_bills where id=p_bill_id for update;
  if v_bill.id is null then raise exception 'vendor bill not found' using errcode='P0002'; end if;
  if v_bill.status<>'open' then raise exception 'vendor credits can only be applied to open bills' using errcode='22023'; end if;

  if v_credit.supplier_id is not null and v_bill.supplier_id is not null and v_credit.supplier_id<>v_bill.supplier_id then raise exception 'vendor credit supplier does not match bill supplier' using errcode='22023'; end if;
  if (v_credit.supplier_id is null or v_bill.supplier_id is null) and lower(trim(v_credit.vendor))<>lower(trim(v_bill.vendor)) then raise exception 'vendor credit vendor does not match bill vendor' using errcode='22023'; end if;

  if v_bill.purchase_order_id is not null then
    select status into v_po_status from public.finance_purchase_orders where id=v_bill.purchase_order_id for update;
    if v_po_status='closed' then raise exception 'reopen the closed purchase order before applying a vendor credit' using errcode='22023'; end if;
    if v_credit.purchase_order_id is not null and v_credit.purchase_order_id<>v_bill.purchase_order_id then raise exception 'vendor credit is linked to a different purchase order' using errcode='22023'; end if;
    if v_credit.purchase_order_id is null then
      update public.finance_vendor_credits set purchase_order_id=v_bill.purchase_order_id,supplier_id=coalesce(supplier_id,v_bill.supplier_id),updated_at=now() where id=v_credit.id returning * into v_credit;
      insert into public.finance_purchase_order_events(purchase_order_id,event_type,reason,after_snapshot,created_by)
      values(v_bill.purchase_order_id,'vendor_credit_linked',v_credit.credit_number,jsonb_build_object('creditId',v_credit.id,'creditNumber',v_credit.credit_number),auth.uid());
    end if;
  elsif v_credit.purchase_order_id is not null then
    raise exception 'this purchase-order credit can only be applied to a bill linked to the same purchase order' using errcode='22023';
  end if;

  select coalesce(sum(amount),0),coalesce(sum(gst_hst_tax),0),coalesce(sum(pst_tax),0) into v_ca,v_cg,v_cp from public.finance_vendor_credit_applications where credit_id=v_credit.id and status='active';
  select coalesce(sum(amount),0),coalesce(sum(gst_hst_tax),0),coalesce(sum(pst_tax),0) into v_ba,v_bg,v_bp from public.finance_vendor_credit_applications where bill_id=v_bill.id and status='active';
  v_avail_a:=greatest(round(v_credit.amount-v_ca,2),0); v_avail_g:=greatest(round(v_credit.gst_hst_tax-v_cg,2),0); v_avail_p:=greatest(round(v_credit.pst_tax-v_cp,2),0);
  v_due_a:=greatest(round(v_bill.amount-v_ba,2),0); v_due_g:=greatest(round(v_bill.gst_hst_tax-v_bg,2),0); v_due_p:=greatest(round(v_bill.pst_tax-v_bp,2),0);
  v_apply_a:=least(v_avail_a,v_due_a); v_apply_g:=least(v_avail_g,v_due_g); v_apply_p:=least(v_avail_p,v_due_p);
  if round(v_apply_a+v_apply_g+v_apply_p,2)<=0 then raise exception 'this credit has no component value that can be applied to the remaining bill' using errcode='22023'; end if;

  insert into public.finance_vendor_credit_applications(credit_id,bill_id,amount,gst_hst_tax,pst_tax,status,note,created_by,created_at)
  values(v_credit.id,v_bill.id,v_apply_a,v_apply_g,v_apply_p,'active',v_note,auth.uid(),now()) returning * into v_app;

  v_credit_remain:=round((v_avail_a-v_apply_a)+(v_avail_g-v_apply_g)+(v_avail_p-v_apply_p),2);
  update public.finance_vendor_credits set status=case when v_credit_remain<=0.01 then 'applied' else 'open' end,updated_at=now() where id=v_credit.id returning * into v_after_credit;

  v_bill_remain:=round((v_due_a-v_apply_a)+(v_due_g-v_apply_g)+(v_due_p-v_apply_p),2);
  if v_bill_remain<=0.01 then
    update public.finance_vendor_bills set status='settled',settled_at=now(),settled_by=auth.uid(),payment_method='Vendor credit',payment_reference='Settled by vendor credit',updated_at=now() where id=v_bill.id returning * into v_after_bill;
  else
    select * into v_after_bill from public.finance_vendor_bills where id=v_bill.id;
  end if;

  insert into public.finance_vendor_credit_events(credit_id,event_type,after_snapshot,created_by)
  values(v_credit.id,'applied',jsonb_build_object('application',to_jsonb(v_app),'billId',v_bill.id,'billNumber',v_bill.bill_number,'billRemaining',v_bill_remain),auth.uid());
  insert into public.finance_vendor_bill_events(bill_id,event_type,reason,after_snapshot,created_by)
  values(v_bill.id,'credit_applied',v_after_credit.credit_number,jsonb_build_object('applicationId',v_app.id,'creditId',v_credit.id,'creditNumber',v_after_credit.credit_number,'appliedTotal',round(v_apply_a+v_apply_g+v_apply_p,2),'billRemaining',v_bill_remain),auth.uid());
  if v_bill_remain<=0.01 then
    insert into public.finance_vendor_bill_events(bill_id,event_type,reason,after_snapshot,created_by)
    values(v_bill.id,'credit_settled',v_after_credit.credit_number,to_jsonb(v_after_bill),auth.uid());
  end if;
  return jsonb_build_object('application',to_jsonb(v_app),'credit',to_jsonb(v_after_credit),'bill',to_jsonb(v_after_bill),'billRemaining',v_bill_remain);
end; $$;

create or replace function private.finance_reverse_vendor_credit_application_impl(p_application_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
  v_app public.finance_vendor_credit_applications;
  v_after_app public.finance_vendor_credit_applications;
  v_credit public.finance_vendor_credits;
  v_bill public.finance_vendor_bills;
  v_reason text:=nullif(trim(coalesce(p_reason,'')),'');
  v_po_status text;
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode='42501'; end if;
  if p_application_id is null or v_reason is null then raise exception 'credit application and reversal reason are required' using errcode='22023'; end if;
  if char_length(v_reason)>500 then raise exception 'reversal reason is too long' using errcode='22001'; end if;
  select * into v_app from public.finance_vendor_credit_applications where id=p_application_id for update;
  if v_app.id is null then raise exception 'credit application not found' using errcode='P0002'; end if;
  if v_app.status<>'active' then raise exception 'only an active credit application can be reversed' using errcode='22023'; end if;
  select * into v_credit from public.finance_vendor_credits where id=v_app.credit_id for update;
  select * into v_bill from public.finance_vendor_bills where id=v_app.bill_id for update;
  if v_bill.status in ('paid','voided') then raise exception 'credit application cannot be reversed after bill payment or void' using errcode='22023'; end if;
  if v_bill.purchase_order_id is not null then
    select status into v_po_status from public.finance_purchase_orders where id=v_bill.purchase_order_id for update;
    if v_po_status='closed' then raise exception 'reopen the closed purchase order before reversing a credit application' using errcode='22023'; end if;
  end if;
  update public.finance_vendor_credit_applications set status='reversed',reversed_at=now(),reversed_by=auth.uid(),reverse_reason=v_reason where id=v_app.id returning * into v_after_app;
  update public.finance_vendor_credits set status='open',updated_at=now() where id=v_credit.id returning * into v_credit;
  if v_bill.status='settled' then
    update public.finance_vendor_bills set status='open',settled_at=null,settled_by=null,payment_method=null,payment_reference=null,updated_at=now() where id=v_bill.id returning * into v_bill;
  end if;
  insert into public.finance_vendor_credit_events(credit_id,event_type,reason,before_snapshot,after_snapshot,created_by) values(v_credit.id,'application_reversed',v_reason,to_jsonb(v_app),to_jsonb(v_after_app),auth.uid());
  insert into public.finance_vendor_bill_events(bill_id,event_type,reason,after_snapshot,created_by) values(v_bill.id,'credit_application_reversed',v_reason,jsonb_build_object('applicationId',v_app.id,'creditId',v_credit.id),auth.uid());
  return jsonb_build_object('application',to_jsonb(v_after_app),'credit',to_jsonb(v_credit),'bill',to_jsonb(v_bill));
end; $$;

revoke all on function private.finance_create_vendor_credit_impl(date,text,text,text,numeric,numeric,numeric,uuid,uuid,text) from public,anon;
revoke all on function private.finance_void_vendor_credit_impl(uuid,text) from public,anon;
revoke all on function private.finance_apply_vendor_credit_impl(uuid,uuid,text) from public,anon;
revoke all on function private.finance_reverse_vendor_credit_application_impl(uuid,text) from public,anon;
grant execute on function private.finance_create_vendor_credit_impl(date,text,text,text,numeric,numeric,numeric,uuid,uuid,text) to authenticated,service_role;
grant execute on function private.finance_void_vendor_credit_impl(uuid,text) to authenticated,service_role;
grant execute on function private.finance_apply_vendor_credit_impl(uuid,uuid,text) to authenticated,service_role;
grant execute on function private.finance_reverse_vendor_credit_application_impl(uuid,text) to authenticated,service_role;

create or replace function public.create_admin_vendor_credit(p_issue_date date,p_vendor text,p_credit_number text,p_description text,p_amount numeric,p_gst_hst_tax numeric default 0,p_pst_tax numeric default 0,p_supplier_id uuid default null,p_purchase_order_id uuid default null,p_notes text default null)
returns jsonb language sql security invoker set search_path=pg_catalog as $$ select private.finance_create_vendor_credit_impl(p_issue_date,p_vendor,p_credit_number,p_description,p_amount,p_gst_hst_tax,p_pst_tax,p_supplier_id,p_purchase_order_id,p_notes); $$;
create or replace function public.void_admin_vendor_credit(p_credit_id uuid,p_reason text)
returns jsonb language sql security invoker set search_path=pg_catalog as $$ select private.finance_void_vendor_credit_impl(p_credit_id,p_reason); $$;
create or replace function public.apply_admin_vendor_credit(p_credit_id uuid,p_bill_id uuid,p_note text default null)
returns jsonb language sql security invoker set search_path=pg_catalog as $$ select private.finance_apply_vendor_credit_impl(p_credit_id,p_bill_id,p_note); $$;
create or replace function public.reverse_admin_vendor_credit_application(p_application_id uuid,p_reason text)
returns jsonb language sql security invoker set search_path=pg_catalog as $$ select private.finance_reverse_vendor_credit_application_impl(p_application_id,p_reason); $$;

revoke all on function public.create_admin_vendor_credit(date,text,text,text,numeric,numeric,numeric,uuid,uuid,text) from public,anon;
revoke all on function public.void_admin_vendor_credit(uuid,text) from public,anon;
revoke all on function public.apply_admin_vendor_credit(uuid,uuid,text) from public,anon;
revoke all on function public.reverse_admin_vendor_credit_application(uuid,text) from public,anon;
grant execute on function public.create_admin_vendor_credit(date,text,text,text,numeric,numeric,numeric,uuid,uuid,text) to authenticated,service_role;
grant execute on function public.void_admin_vendor_credit(uuid,text) to authenticated,service_role;
grant execute on function public.apply_admin_vendor_credit(uuid,uuid,text) to authenticated,service_role;
grant execute on function public.reverse_admin_vendor_credit_application(uuid,text) to authenticated,service_role;