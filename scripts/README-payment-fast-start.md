# Payment fast-start

This branch reduces Payment Step 2 latency without changing payment authority or consent rules.

- Stripe network is preconnected before Step 2.
- Checkout tracking and secure session preparation start only after the customer intentionally presses Continue to payment.
- Step 2 reuses the already-running preparation promise instead of starting duplicate checkout work.
- Final Terms/Privacy acceptance remains required immediately before Stripe confirmation.
- Server-authoritative pricing, inventory reservation, tax, webhooks, and Finance/Cash Flow remain unchanged.
