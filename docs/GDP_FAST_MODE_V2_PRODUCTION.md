# FAST MODE production readiness

Production-ready means the deployed main commit has passed the required live smoke validation. If the smoke finds a stale test rather than a product defect, repair the test contract without weakening the intended assertion, then rerun production verification after the repair is safely merged and deployed.
