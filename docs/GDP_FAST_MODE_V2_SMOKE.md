# FAST MODE production smoke

Production smoke is the final completion gate after Cloudflare deployment. It should validate the live site and produce artifacts on failure.

When one smoke regression fails, preserve the evidence, diagnose that regression immediately and repair the smallest affected surface. Do not call production 100% until the final smoke run is green.

Smoke tests should be robust to expected UI recovery state and use stable product contracts.
