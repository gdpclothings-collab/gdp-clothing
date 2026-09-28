# FAST MODE transient failures

If evidence shows a runner/network/provider transient rather than a code regression, rerun only the failed job or failed jobs when possible. Do not create product-code changes to mask infrastructure failures. If the same failure repeats deterministically, treat it as a real blocker and diagnose it.
