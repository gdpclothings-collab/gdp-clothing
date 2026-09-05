-- Publish essential GDP Clothing storefront pages that are already linked by the UI.
-- Content is intentionally concise and operational; it can be edited later in Admin.

insert into public.content_pages (title, slug, page_type, excerpt, body, seo, status, published_at)
values
(
  'About GDP Clothing',
  'about',
  'page',
  'Custom apparel and personalized streetwear made around real people, memories, milestones, and ideas.',
  jsonb_build_object('content', $about$
Last updated September 5, 2026.

GDP Clothing is a Saskatoon, Saskatchewan custom-apparel business built around a simple idea: clothing can carry a story.

We create personalized tees, streetwear-inspired designs, photo-based keepsakes, and custom pieces for families, pets, birthdays, memorials, teams, events, and everyday moments.

Our custom process is designed to keep the customer involved. You choose the garment and creative direction, upload the photos or artwork you are authorized to use, and provide the names, dates, messages, or notes that matter. When a design proof is required, production begins only after approval.

GDP Clothing combines local service with a modern online ordering workflow so customers can move from idea to finished apparel with clear order, proof, payment, and fulfillment steps.

Questions about an order or custom project can be sent to gdpclothings@gmail.com.
$about$),
  jsonb_build_object(
    'title', 'About GDP Clothing | Custom Apparel in Saskatoon',
    'description', 'Learn about GDP Clothing, a Saskatoon custom-apparel business creating personalized tees, photo designs, streetwear and keepsakes.'
  ),
  'published',
  now()
),
(
  'Privacy Policy',
  'privacy',
  'policy',
  'How GDP Clothing handles customer account, order, artwork, payment, and support information.',
  jsonb_build_object('content', $privacy$
Last updated September 5, 2026.

GDP Clothing collects information needed to operate the store, provide custom-design services, process orders, support customers, and protect the website.

Information we may process includes account and contact details, shipping information, order history, custom-design instructions, photos or artwork you upload, proof feedback, support messages, and technical information generated when you use the website.

Payment card information is handled through Stripe's secure payment services. GDP Clothing does not store full card numbers in its application database.

Store accounts, order data, and private customer uploads are supported by Supabase services. Access to private customer artwork is restricted through authenticated storage and database access controls.

We use customer information to fulfill orders, provide proofs and support, maintain store operations, prevent abuse, and meet applicable accounting, tax, legal, and security requirements.

We do not ask customers to upload content they do not have the right or permission to use. Custom artwork and customer photos should contain only material you are authorized to submit.

If you want to ask about your information, request a correction, or request deletion where applicable, contact gdpclothings@gmail.com. Some records may need to be retained when required for completed transactions, legal obligations, fraud prevention, or accounting.

This policy may be updated as the GDP Clothing service changes. The current version will be published on this page.
$privacy$),
  jsonb_build_object(
    'title', 'Privacy Policy | GDP Clothing',
    'description', 'GDP Clothing privacy information for customer accounts, orders, uploaded artwork, payments and support.'
  ),
  'published',
  now()
),
(
  'Terms of Service',
  'terms',
  'policy',
  'Store terms for GDP Clothing purchases, custom artwork, proof approval, payment, and fulfillment.',
  jsonb_build_object('content', $terms$
Last updated September 5, 2026.

By placing an order with GDP Clothing, you agree to provide accurate order and contact information and to pay the amount shown at checkout.

Prices are displayed in Canadian dollars unless otherwise stated. Taxes and shipping are calculated during checkout using the destination and current store rules.

For custom orders, you confirm that you own, created, licensed, or otherwise have permission to use the photos, logos, artwork, names, text, and other material you submit. You are responsible for the content you provide.

A custom order may require a digital proof before production. When proof approval is required, production begins after the approved version is confirmed. Requested revisions are subject to the revision allowance shown for the custom order.

Colors, placement, sizing, and print appearance can vary slightly between a screen preview and a physical garment due to monitor settings, garment materials, print processes, and normal production tolerances.

GDP Clothing may decline content or an order that cannot reasonably be produced, appears unlawful, infringes another party's rights, or presents a safety, fraud, or payment risk. If a paid order cannot be fulfilled, the appropriate refund or resolution will be provided.

Shipping estimates are estimates rather than guaranteed delivery dates unless GDP Clothing explicitly confirms otherwise in writing.

These terms do not limit consumer rights that cannot legally be excluded.

For order or policy questions, contact gdpclothings@gmail.com.
$terms$),
  jsonb_build_object(
    'title', 'Terms of Service | GDP Clothing',
    'description', 'GDP Clothing terms for purchases, custom artwork rights, proof approval, payment, shipping and fulfillment.'
  ),
  'published',
  now()
),
(
  'Shipping & Returns',
  'shipping-returns',
  'policy',
  'Current GDP Clothing shipping, Saskatoon pickup, custom-order, and return information.',
  jsonb_build_object('content', $shipping$
Last updated September 5, 2026.

Canada shipping

GDP Clothing's online checkout currently supports Canadian shipping addresses. Standard Canadian shipping is $12.99 CAD, with free standard shipping when the eligible order amount reaches $150 CAD. Shipping rules displayed at checkout are the authoritative rate for the order.

Local pickup

Free local pickup is available in Saskatoon when that option is offered at checkout. Pickup instructions are provided with the order when it is ready.

Processing and custom orders

Custom orders may require artwork review and proof approval before production. Production and delivery timing therefore begins from the applicable design or proof stage rather than simply from the date an order was submitted.

Delivery estimates are not guarantees. Carrier delays, weather, address issues, custom-design revisions, inventory availability, and production requirements can affect timing.

Returns

Because personalized and made-to-order products are produced specifically for the customer, custom items are generally final sale unless the item is defective, damaged, or materially different from the approved order.

Eligible non-custom items may be requested for return within 14 days of delivery when they are unworn, unused, and in original condition. Contact GDP Clothing before sending a return so the order can be reviewed and return instructions can be provided.

If GDP Clothing shipped the wrong item or the product arrived defective or damaged, contact gdpclothings@gmail.com with the order number and clear photos of the issue.

This policy does not remove rights or remedies that apply under law.
$shipping$),
  jsonb_build_object(
    'title', 'Shipping & Returns | GDP Clothing',
    'description', 'GDP Clothing Canadian shipping, Saskatoon pickup, custom-order timing and return information.'
  ),
  'published',
  now()
)
on conflict (slug) do update
set
  title = excluded.title,
  page_type = excluded.page_type,
  excerpt = excluded.excerpt,
  body = excluded.body,
  seo = excluded.seo,
  status = excluded.status,
  published_at = coalesce(public.content_pages.published_at, excluded.published_at),
  updated_at = now();
