# GDP Clothing FAST MODE

All implementation PRs follow `docs/GDP_FAST_MODE_V2.md`.

Operating rule: classify risk, run independent checks in parallel, diagnose failures immediately, repair the smallest affected surface, rerun the failed/affected test first, then finish the remaining required gates. A blocker is never permission to bypass a safety gate.

100% = merged + production deployed + production smoke green.
