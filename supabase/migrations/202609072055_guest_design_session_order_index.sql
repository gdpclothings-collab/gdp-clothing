create index if not exists guest_design_sessions_converted_order_id_idx
  on public.guest_design_sessions(converted_order_id)
  where converted_order_id is not null;
