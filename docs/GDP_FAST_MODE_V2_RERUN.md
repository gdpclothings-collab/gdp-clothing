# FAST MODE targeted rerun

When GitHub Actions supports it and the failure is isolated, rerun the failed job rather than restarting already-green jobs. If code changes are required, validate the new PR head normally because the commit changed. This distinction avoids wasted reruns without validating stale code.
