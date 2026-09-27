# GDP Clothing deployment workflow

## Mandatory path

All code and schema changes use this path:

1. Read current `main` and confirm it is healthy.
2. Create a dedicated branch from the exact current `main` ref.
3. Confirm the branch exists before the first write.
4. Make all writes with the branch explicitly specified. Never omit `branch` on a feature write.
5. Run branch/PR quality checks.
6. Open a pull request into `main`.
7. Merge only when the PR is mergeable and required checks pass.
8. Let the `main` push trigger Cloudflare production deployment.
9. Run/observe production smoke and regression checks against the merged SHA.
10. Call work 100% only after production verification passes.

## Safety rules

- Never use `main` as a scratch branch.
- Never fall back to a default-branch write when a branch-targeted write fails.
- A failed branch write is a blocker: create/repair the branch, then retry the same branch-targeted write.
- Database migrations, checkout, payments, inventory, authentication and Custom Studio changes require isolated PRs whenever practical.
- Do not weaken a production assertion just to obtain a green CI result; update stale selectors while preserving behavioral assertions.
- Record the merged SHA used for production verification.
- Keep Canada Post/carrier-rate activation separate from manual shipping-rate administration so checkout has a safe fallback.

## Completion states

- 0–60%: implementation on feature branch.
- 60–80%: branch validation / PR checks.
- 80–90%: merged and deploying.
- 90–99%: production smoke/regression verification.
- 100%: merged SHA deployed and required production checks passed.

## Emergency exception

Direct writes to `main` are prohibited for normal feature work. If an emergency production repair truly requires one, document the reason, make the smallest possible change, and immediately run the same production verification suite.
