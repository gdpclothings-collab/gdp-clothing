# FAST MODE blocker recovery

For a failed required job:

1. Read the failed step and logs immediately.
2. Use uploaded smoke artifacts/screenshots when browser behavior is involved.
3. Decide whether the failure is product code, stale test contract, transient infrastructure, or deployment propagation.
4. Fix only the smallest affected surface.
5. Rerun the failed job/test first when GitHub permits targeted reruns.
6. Do not rerun already-green independent jobs unless the repair can affect them.
7. Before merge, complete all required checks for the risk tier.
8. After merge, require Cloudflare + production smoke.

This is the default GDP Clothing implementation behavior.
