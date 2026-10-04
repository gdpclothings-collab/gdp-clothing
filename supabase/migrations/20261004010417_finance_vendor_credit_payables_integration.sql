create or replace function private.finance_create_expense_impl(p_occurred_on date, p_vendor text, p_category text, p_description text, p_amount numeric, p_tax numeric default 0, p_gst_hst_tax numeric default null, p_pst_tax numeric default null, p_itc_eligible boolean default false, p_payment_method text default null, p_receipt_reference text default null, p_notes text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  v_row public.finance_expenses;
  v_description text := nullif(trim(coalesce(p_description,'')), '');
  v_vendor text := nullif(trim(coalesce(p_vendor,'')), '');
  v_category text := lower(trim(coalesce(p_category,'miscellaneous')));
  v_payment text := nullif(trim(coalesce(p_payment_method,'')), '');
  v_receipt text := nullif(trim(coalesce(p_receipt_reference,'')), '');
  v_notes text := nullif(trim(coalesce(p_notes,'')), '');
  v_amount numeric := round(coalesce(p_amount,0),2);
  v_tax numeric := round(coalesce(p_tax,0),2);
  v_gst numeric := case when p_gst_hst_tax is null then null else round(p_gst_hst_tax,2) end;
  v_pst numeric := case when p_pst_tax is null then null else round(p_pst_tax,2) end;
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode='42501'; end if;
  if p_occurred_on is null then raise exception 'expense date is required' using errcode='22023'; end if;
  if p_occurred_on > (now() at time zone 'America/Regina')::date then raise exception 'expense date cannot be in the future' using errcode='22023'; end if;
  if v_description is null then raise exception 'expense description is required' using errcode='22023'; end if;
  if v_amount < 0 or (v_amount=0 and v_tax<=0) then raise exception 'expense total must be greater than zero' using errcode='22023'; end if;
  if v_tax < 0 or coalesce(v_gst,0) < 0 or coalesce(v_pst,0) < 0 then raise exception 'expense tax amounts cannot be negative' using errcode='22023'; end if;
  if char_length(v_description) > 500 or char_length(coalesce(v_vendor,'')) > 200 or char_length(v_category) > 100 or char_length(coalesce(v_payment,'')) > 100 or char_length(coalesce(v_receipt,'')) > 200 or char_length(coalesce(v_notes,'')) > 1000 then raise exception 'one or more expense text fields are too long' using errcode='22001'; end if;
  insert into public.finance_expenses(occurred_on,vendor,category,description,amount,tax,gst_hst_tax,pst_tax,gst_hst_itc_eligible,currency,payment_method,receipt_reference,notes,status,created_by,created_at,updated_at)
  values(p_occurred_on,v_vendor,v_category,v_description,v_amount,v_tax,v_gst,v_pst,case when coalesce(v_gst,0)>0 then coalesce(p_itc_eligible,false) else false end,'CAD',v_payment,v_receipt,v_notes,'active',auth.uid(),now(),now()) returning * into v_row;
  insert into public.finance_expense_events(expense_id,event_type,after_snapshot,created_by) values(v_row.id,'created',to_jsonb(v_row),auth.uid());
  return to_jsonb(v_row);
end; $$;

create or replace function private.finance_mark_vendor_bill_paid_impl(p_bill_id uuid,p_paid_on date,p_payment_method text,p_payment_reference text default null,p_payment_note text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
  v_before public.finance_vendor_bills;
  v_after public.finance_vendor_bills;
  v_expense jsonb;
  v_expense_id uuid;
  v_payment_method text:=nullif(trim(coalesce(p_payment_method,'')),'');
  v_payment_reference text:=nullif(trim(coalesce(p_payment_reference,'')),'');
  v_payment_note text:=nullif(trim(coalesce(p_payment_note,'')),'');
  v_today date:=(now() at time zone 'America/Regina')::date;
  v_expense_notes text;
  v_credit_amount numeric:=0; v_credit_gst numeric:=0; v_credit_pst numeric:=0;
  v_net_amount numeric; v_net_gst numeric; v_net_pst numeric; v_net_total numeric; v_credit_total numeric;
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode='42501'; end if;
  if p_bill_id is null then raise exception 'bill is required' using errcode='22023'; end if;
  if p_paid_on is null or p_paid_on>v_today then raise exception 'valid payment date is required' using errcode='22023'; end if;
  if v_payment_method is null then raise exception 'payment method is required' using errcode='22023'; end if;
  if char_length(v_payment_method)>100 or char_length(coalesce(v_payment_reference,''))>200 or char_length(coalesce(v_payment_note,''))>500 then raise exception 'one or more payment fields are too long' using errcode='22001'; end if;
  select * into v_before from public.finance_vendor_bills where id=p_bill_id for update;
  if v_before.id is null then raise exception 'bill not found' using errcode='P0002'; end if;
  if v_before.status<>'open' then raise exception 'only open bills can be marked paid' using errcode='22023'; end if;
  if p_paid_on<v_before.issue_date then raise exception 'payment date cannot be before bill issue date' using errcode='22023'; end if;
  select coalesce(sum(amount),0),coalesce(sum(gst_hst_tax),0),coalesce(sum(pst_tax),0) into v_credit_amount,v_credit_gst,v_credit_pst from public.finance_vendor_credit_applications where bill_id=p_bill_id and status='active';
  v_net_amount:=greatest(round(v_before.amount-v_credit_amount,2),0);
  v_net_gst:=greatest(round(v_before.gst_hst_tax-v_credit_gst,2),0);
  v_net_pst:=greatest(round(v_before.pst_tax-v_credit_pst,2),0);
  v_net_total:=round(v_net_amount+v_net_gst+v_net_pst,2);
  v_credit_total:=round(v_credit_amount+v_credit_gst+v_credit_pst,2);
  if v_net_total<=0.01 then raise exception 'bill is fully covered by vendor credits and should already be settled' using errcode='22023'; end if;
  v_expense_notes:=concat_ws(E'\n',v_before.notes,case when v_before.bill_number is not null then 'Vendor bill: '||v_before.bill_number else null end,case when v_credit_total>0 then 'Vendor credits applied: '||to_char(v_credit_total,'FM999999990.00') else null end,case when v_payment_reference is not null then 'Payment reference: '||v_payment_reference else null end,v_payment_note);
  v_expense:=private.finance_create_expense_impl(p_paid_on,v_before.vendor,v_before.category,v_before.description,v_net_amount,round(v_net_gst+v_net_pst,2),v_net_gst,v_net_pst,v_before.gst_hst_itc_eligible,v_payment_method,coalesce(v_before.bill_number,v_payment_reference),nullif(trim(v_expense_notes),''));
  v_expense_id:=(v_expense->>'id')::uuid;
  update public.finance_vendor_bills set status='paid',payment_method=v_payment_method,payment_reference=v_payment_reference,paid_on=p_paid_on,paid_at=now(),paid_by=auth.uid(),expense_id=v_expense_id,updated_at=now() where id=p_bill_id returning * into v_after;
  insert into public.finance_vendor_bill_events(bill_id,event_type,before_snapshot,after_snapshot,created_by) values(p_bill_id,'paid',to_jsonb(v_before),jsonb_build_object('bill',to_jsonb(v_after),'grossTotal',round(v_before.amount+v_before.gst_hst_tax+v_before.pst_tax,2),'creditTotal',v_credit_total,'netPaid',v_net_total),auth.uid());
  return jsonb_build_object('bill',to_jsonb(v_after),'expense',v_expense,'grossTotal',round(v_before.amount+v_before.gst_hst_tax+v_before.pst_tax,2),'creditTotal',v_credit_total,'netPaid',v_net_total);
end; $$;

create or replace function private.finance_get_vendor_bills_impl(p_from date default null,p_to date default null,p_limit integer default 500)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_limit integer:=greatest(25,least(1000,coalesce(p_limit,500))); v_today date:=(now() at time zone 'America/Regina')::date;
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode='42501'; end if;
  return (
    with credits as (
      select bill_id,coalesce(sum(amount),0) credit_amount,coalesce(sum(gst_hst_tax),0) credit_gst,coalesce(sum(pst_tax),0) credit_pst
      from public.finance_vendor_credit_applications where status='active' group by bill_id
    ), filtered as (
      select b.*,po.po_number as purchase_order_number,
        round(b.amount+b.gst_hst_tax+b.pst_tax,2) as gross_total,
        round(coalesce(c.credit_amount,0)+coalesce(c.credit_gst,0)+coalesce(c.credit_pst,0),2) as credit_total,
        greatest(round(b.amount-coalesce(c.credit_amount,0),2),0) as net_amount,
        greatest(round(b.gst_hst_tax-coalesce(c.credit_gst,0),2),0) as net_gst_hst_tax,
        greatest(round(b.pst_tax-coalesce(c.credit_pst,0),2),0) as net_pst_tax,
        round(greatest(b.amount-coalesce(c.credit_amount,0),0)+greatest(b.gst_hst_tax-coalesce(c.credit_gst,0),0)+greatest(b.pst_tax-coalesce(c.credit_pst,0),0),2) as net_total
      from public.finance_vendor_bills b
      left join public.finance_purchase_orders po on po.id=b.purchase_order_id
      left join credits c on c.bill_id=b.id
      where (p_from is null or b.due_date>=p_from) and (p_to is null or b.due_date<=p_to)
    ), limited as (
      select * from filtered order by case status when 'open' then 0 when 'settled' then 1 when 'paid' then 2 else 3 end,due_date asc,created_at desc limit v_limit
    )
    select jsonb_build_object(
      'generatedAt',now(),
      'summary',jsonb_build_object(
        'openCount',coalesce((select count(*) from filtered where status='open'),0),
        'openTotal',coalesce((select sum(net_total) from filtered where status='open'),0),
        'grossOpenTotal',coalesce((select sum(gross_total) from filtered where status='open'),0),
        'creditsAppliedToOpen',coalesce((select sum(credit_total) from filtered where status='open'),0),
        'overdueCount',coalesce((select count(*) from filtered where status='open' and due_date<v_today),0),
        'overdueTotal',coalesce((select sum(net_total) from filtered where status='open' and due_date<v_today),0),
        'due7Count',coalesce((select count(*) from filtered where status='open' and due_date between v_today and v_today+7),0),
        'due7Total',coalesce((select sum(net_total) from filtered where status='open' and due_date between v_today and v_today+7),0),
        'due30Count',coalesce((select count(*) from filtered where status='open' and due_date between v_today and v_today+30),0),
        'due30Total',coalesce((select sum(net_total) from filtered where status='open' and due_date between v_today and v_today+30),0),
        'paidCount',coalesce((select count(*) from filtered where status='paid'),0),
        'paidTotal',coalesce((select sum(net_total) from filtered where status='paid'),0),
        'settledCount',coalesce((select count(*) from filtered where status='settled'),0),
        'settledGrossTotal',coalesce((select sum(gross_total) from filtered where status='settled'),0),
        'voidedCount',coalesce((select count(*) from filtered where status='voided'),0),
        'poLinkedCount',coalesce((select count(*) from filtered where purchase_order_id is not null and status<>'voided'),0)
      ),
      'bills',coalesce((select jsonb_agg(to_jsonb(l) order by case l.status when 'open' then 0 when 'settled' then 1 when 'paid' then 2 else 3 end,l.due_date asc,l.created_at desc) from limited l),'[]'::jsonb),
      'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc) from (select ev.id,ev.bill_id,ev.event_type,ev.reason,ev.created_at from public.finance_vendor_bill_events ev join filtered f on f.id=ev.bill_id order by ev.created_at desc limit least(v_limit*4,2000)) e),'[]'::jsonb)
    )
  );
end; $$;