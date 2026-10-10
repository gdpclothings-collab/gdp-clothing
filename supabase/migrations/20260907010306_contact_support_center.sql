begin;

alter table public.support_tickets
  add column if not exists category text,
  add column if not exists customer_phone text,
  add column if not exists order_number text,
  add column if not exists source text not null default 'support';

create index if not exists support_tickets_status_created_at_idx
  on public.support_tickets(status, created_at desc);

create index if not exists support_tickets_customer_email_created_at_idx
  on public.support_tickets(lower(customer_email), created_at desc);

update public.content_pages
set
  body = coalesce(body, '{}'::jsonb) || jsonb_build_object(
    'template', 'contact',
    'intro', 'Need help with an order, a custom design, or a product question? Send us a message and it will go directly to the GDP Clothing support queue.',
    'responseTime', 'We normally reply within 1 business day.',
    'locationNote', 'Proudly based in Saskatoon, Saskatchewan, Canada.',
    'formHeading', 'Send us a message',
    'formHelper', 'Tell us what you need and include your order number when your question is about an existing order.',
    'customTitle', 'Planning a custom piece?',
    'customText', 'If you already know what you want to create, start in the Custom Studio to choose a garment, upload artwork, and build your design.',
    'faqTitle', 'Looking for a quick answer?',
    'faqText', 'Check common questions about ordering, custom designs, shipping, sizing, and store policies before sending a message.'
  ),
  excerpt = coalesce(
    nullif(excerpt, ''),
    'Questions, custom requests, and order support.'
  ),
  seo = coalesce(seo, '{}'::jsonb) || jsonb_build_object(
    'title', 'Contact GDP Clothing',
    'description', 'Contact GDP Clothing for order support, custom apparel, product questions, shipping help, returns, and general inquiries.'
  ),
  updated_at = now()
where slug = 'contact';

update public.store_settings
set
  contact_email = coalesce(nullif(contact_email, ''), 'hello@gdpclothing.ca'),
  updated_at = now()
where id = 1;

commit;
