# FAST MODE no-regression rule

A speed optimization is accepted only when it preserves the behavior assertions appropriate to the risk tier. If a regression test fails because its selector is stale, replace the selector with the current stable product contract while keeping the underlying behavior assertion. If product behavior is actually broken, fix product code instead of weakening the test.
