-- The Gildan adult crewneck is a Custom Studio blank. When the product was
-- introduced after selling_mode became required, the column was omitted and
-- inherited the ready_to_wear default. That causes custom checkout order-item
-- validation to reject the saved Custom Studio design before Stripe can load.
--
-- Keep this correction slug-scoped and idempotent so it is safe on production
-- and on fresh database rebuilds.
update public.products
set
  selling_mode = 'custom',
  updated_at = now()
where slug = 'gildan-adult-crewneck-sweatshirt-custom'
  and custom_designable = true
  and selling_mode is distinct from 'custom';
