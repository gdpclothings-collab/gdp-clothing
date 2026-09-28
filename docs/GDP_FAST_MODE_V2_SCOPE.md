# FAST MODE scoped repair rule

When a blocker is isolated, change only the affected implementation/test/workflow surface. Avoid opportunistic refactors while recovering a production gate. This keeps review, CI and regression scope small and makes rollback straightforward.
