# FAST MODE payment guardrails

Checkout/payment work is always RED-risk.

Creating a Stripe checkout/payment session must not itself mark a guest custom design converted/ordered. Conversion and order finalization must follow confirmed payment through the existing verified payment lifecycle. Retry, Back/Edit → Payment, failed-payment and abandoned-payment paths must remain recoverable according to the production implementation.

FAST MODE may accelerate tests and diagnosis but may not bypass these invariants.
