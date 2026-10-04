create or replace function private.finance_get_vendor_credits_impl(p_limit integer default 500)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_limit integer:=greatest(25,least(1000,coalesce(p_limit,500)));
begin
  if not public.is_admin_step_up_authorized() then raise exception 'admin step-up access required' using errcode='42501'; end if;
  return (
    with credit_apps as (
      select credit_id,
        coalesce(sum(amount),0) applied_amount,
        coalesce(sum(gst_hst_tax),0) applied_gst,
        coalesce(sum(pst_tax),0) applied_pst
      from public.finance_vendor_credit_applications where status='active' group by credit_id
    ), bill_apps as (
      select bill_id,
        coalesce(sum(amount),0) applied_amount,
        coalesce(sum(gst_hst_tax),0) applied_gst,
        coalesce(sum(pst_tax),0) applied_pst
      from public.finance_vendor_credit_applications where status='active' group by bill_id
    ), credit_rows as (
      select c.*,po.po_number as purchase_order_number,
        round(c.amount+c.gst_hst_tax+c.pst_tax,2) as total,
        round(coalesce(a.applied_amount,0)+coalesce(a.applied_gst,0)+coalesce(a.applied_pst,0),2) as applied_total,
        greatest(round(c.amount-coalesce(a.applied_amount,0),2),0) as remaining_amount,
        greatest(round(c.gst_hst_tax-coalesce(a.applied_gst,0),2),0) as remaining_gst_hst_tax,
        greatest(round(c.pst_tax-coalesce(a.applied_pst,0),2),0) as remaining_pst_tax,
        round(greatest(c.amount-coalesce(a.applied_amount,0),0)+greatest(c.gst_hst_tax-coalesce(a.applied_gst,0),0)+greatest(c.pst_tax-coalesce(a.applied_pst,0),0),2) as remaining_total,
        coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
          select app.id,app.bill_id,app.amount,app.gst_hst_tax,app.pst_tax,app.status,app.note,app.created_at,app.reversed_at,app.reverse_reason,b.bill_number,b.vendor as bill_vendor,b.status as bill_status
          from public.finance_vendor_credit_applications app join public.finance_vendor_bills b on b.id=app.bill_id
          where app.credit_id=c.id order by app.created_at desc limit 100
        ) x),'[]'::jsonb) as applications
      from public.finance_vendor_credits c
      left join public.finance_purchase_orders po on po.id=c.purchase_order_id
      left join credit_apps a on a.credit_id=c.id
    ), return_rows as (
      select pr.*,po.po_number,s.name as supplier_name,r.receipt_number,vc.credit_number,
        round(vc.amount+vc.gst_hst_tax+vc.pst_tax,2) as credit_total,
        vc.status as credit_status,
        coalesce((select jsonb_agg(jsonb_build_object(
          'id',pri.id,'purchaseReceiptItemId',pri.purchase_receipt_item_id,'purchaseOrderItemId',pri.purchase_order_item_id,
          'quantityReturned',pri.quantity_returned,'creditAmount',pri.credit_amount,'creditGstHstTax',pri.credit_gst_hst_tax,'creditPstTax',pri.credit_pst_tax,
          'lineNumber',poi.line_number,'sku',poi.sku,'description',poi.description,'inventoryVariantId',poi.inventory_variant_id
        ) order by poi.line_number)
        from public.finance_purchase_return_items pri join public.finance_purchase_order_items poi on poi.id=pri.purchase_order_item_id
        where pri.return_id=pr.id),'[]'::jsonb) as items
      from public.finance_purchase_returns pr
      join public.finance_purchase_orders po on po.id=pr.purchase_order_id
      join public.finance_suppliers s on s.id=po.supplier_id
      join public.finance_purchase_receipts r on r.id=pr.receipt_id
      join public.finance_vendor_credits vc on vc.id=pr.vendor_credit_id
    ), returnable_receipts as (
      select r.id,r.receipt_number,r.purchase_order_id,r.received_date,r.location_id,po.po_number,s.id as supplier_id,s.name as supplier_name,loc.name as location_name,
        coalesce((select jsonb_agg(jsonb_build_object(
          'purchaseReceiptItemId',ri.id,
          'purchaseOrderItemId',ri.purchase_order_item_id,
          'lineNumber',poi.line_number,
          'sku',poi.sku,
          'description',poi.description,
          'quantityReceived',ri.quantity_received,
          'quantityReturned',coalesce((select sum(pri.quantity_returned) from public.finance_purchase_return_items pri join public.finance_purchase_returns pr on pr.id=pri.return_id where pri.purchase_receipt_item_id=ri.id and pr.status='posted'),0),
          'returnableQuantity',greatest(ri.quantity_received-coalesce((select sum(pri.quantity_returned) from public.finance_purchase_return_items pri join public.finance_purchase_returns pr on pr.id=pri.return_id where pri.purchase_receipt_item_id=ri.id and pr.status='posted'),0),0),
          'unitCost',poi.unit_cost,
          'gstHstTax',poi.gst_hst_tax,
          'pstTax',poi.pst_tax,
          'inventoryVariantId',poi.inventory_variant_id,
          'inventoryVariant',case when pv.id is null then null else jsonb_build_object('id',pv.id,'sku',pv.sku,'name',pv.name,'color',pv.color,'size',pv.size,'stock',pv.stock) end
        ) order by poi.line_number)
        from public.finance_purchase_receipt_items ri
        join public.finance_purchase_order_items poi on poi.id=ri.purchase_order_item_id
        left join public.product_variants pv on pv.id=poi.inventory_variant_id
        where ri.receipt_id=r.id and ri.quantity_received>coalesce((select sum(pri.quantity_returned) from public.finance_purchase_return_items pri join public.finance_purchase_returns pr on pr.id=pri.return_id where pri.purchase_receipt_item_id=ri.id and pr.status='posted'),0)
        ),'[]'::jsonb) as items
      from public.finance_purchase_receipts r
      join public.finance_purchase_orders po on po.id=r.purchase_order_id and po.status='approved'
      join public.finance_suppliers s on s.id=po.supplier_id
      left join public.inventory_locations loc on loc.id=r.location_id
      where r.status='posted' and exists(
        select 1 from public.finance_purchase_receipt_items ri
        where ri.receipt_id=r.id and ri.quantity_received>coalesce((select sum(pri.quantity_returned) from public.finance_purchase_return_items pri join public.finance_purchase_returns pr on pr.id=pri.return_id where pri.purchase_receipt_item_id=ri.id and pr.status='posted'),0)
      )
    ), open_bills as (
      select b.id,b.vendor,b.supplier_id,b.purchase_order_id,b.bill_number,b.due_date,b.status,po.po_number as purchase_order_number,
        round(b.amount+b.gst_hst_tax+b.pst_tax,2) as gross_total,
        round(coalesce(a.applied_amount,0)+coalesce(a.applied_gst,0)+coalesce(a.applied_pst,0),2) as credit_total,
        round(greatest(b.amount-coalesce(a.applied_amount,0),0)+greatest(b.gst_hst_tax-coalesce(a.applied_gst,0),0)+greatest(b.pst_tax-coalesce(a.applied_pst,0),0),2) as net_total
      from public.finance_vendor_bills b left join public.finance_purchase_orders po on po.id=b.purchase_order_id left join bill_apps a on a.bill_id=b.id
      where b.status='open'
    )
    select jsonb_build_object(
      'generatedAt',now(),
      'summary',jsonb_build_object(
        'openCreditCount',(select count(*) from credit_rows where status='open'),
        'availableCreditTotal',coalesce((select sum(remaining_total) from credit_rows where status='open'),0),
        'appliedCreditCount',(select count(*) from credit_rows where status='applied'),
        'voidedCreditCount',(select count(*) from credit_rows where status='voided'),
        'postedReturnCount',(select count(*) from return_rows where status='posted'),
        'postedReturnCreditTotal',coalesce((select sum(credit_total) from return_rows where status='posted'),0),
        'returnableReceiptCount',(select count(*) from returnable_receipts),
        'openBillCount',(select count(*) from open_bills)
      ),
      'credits',coalesce((select jsonb_agg(to_jsonb(c) order by case c.status when 'open' then 0 when 'applied' then 1 else 2 end,c.issue_date desc,c.created_at desc) from (select * from credit_rows order by created_at desc limit v_limit)c),'[]'::jsonb),
      'returns',coalesce((select jsonb_agg(to_jsonb(r) order by r.return_date desc,r.created_at desc) from (select * from return_rows order by created_at desc limit v_limit) r),'[]'::jsonb),
      'returnableReceipts',coalesce((select jsonb_agg(to_jsonb(rr) order by rr.received_date desc,rr.receipt_number desc) from returnable_receipts rr),'[]'::jsonb),
      'openBills',coalesce((select jsonb_agg(to_jsonb(ob) order by ob.due_date,ob.bill_number) from open_bills ob),'[]'::jsonb),
      'suppliers',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'status',s.status) order by lower(s.name)) from public.finance_suppliers s where s.status='active'),'[]'::jsonb),
      'purchaseOrders',coalesce((select jsonb_agg(jsonb_build_object('id',po.id,'poNumber',po.po_number,'supplierId',po.supplier_id,'supplierName',s.name,'total',po.total,'orderDate',po.order_date) order by po.created_at desc) from public.finance_purchase_orders po join public.finance_suppliers s on s.id=po.supplier_id where po.status='approved'),'[]'::jsonb),
      'creditEvents',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc) from (select id,credit_id,event_type,reason,created_at from public.finance_vendor_credit_events order by created_at desc limit least(v_limit*4,2000)) e),'[]'::jsonb),
      'returnEvents',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc) from (select id,return_id,event_type,reason,created_at from public.finance_purchase_return_events order by created_at desc limit least(v_limit*4,2000)) e),'[]'::jsonb)
    )
  );
end; $$;

revoke all on function private.finance_get_vendor_credits_impl(integer) from public,anon;
grant execute on function private.finance_get_vendor_credits_impl(integer) to authenticated,service_role;

create or replace function public.get_admin_vendor_credits(p_limit integer default 500)
returns jsonb language sql security invoker set search_path=pg_catalog as $$ select private.finance_get_vendor_credits_impl(p_limit); $$;
revoke all on function public.get_admin_vendor_credits(integer) from public,anon;
grant execute on function public.get_admin_vendor_credits(integer) to authenticated,service_role;