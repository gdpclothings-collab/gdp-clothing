# FAST MODE testing strategy

GREEN: affected checks + build + production smoke.

YELLOW: affected regression + build/quality/security in parallel + production smoke.

RED: affected regression + critical checkout/payment/auth/data/inventory regression as applicable + build/quality/security in parallel + production smoke.

Use accessibility roles/names and explicit data attributes as browser-test contracts. Avoid selectors based only on styling classes, layout wrappers or headings unless the heading itself is the behavior under test.
