# FAST MODE completion gate

A change is not complete because code was committed or a PR merged.

Completion requires:
- implementation complete;
- affected test green;
- required risk-tier regression green;
- required build/quality/security gates green;
- merged to main;
- Cloudflare production deployment green;
- production smoke green.

If production smoke fails, status returns to blocker recovery immediately.
