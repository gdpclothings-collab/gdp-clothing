# FAST MODE parallel CI

Independent validation jobs should start from the same PR head and run concurrently. A failure in one independent job should not cancel unrelated jobs; gathering all independent results in one cycle prevents serial blocker discovery.

Concurrency cancellation is for superseded commits/runs, not for hiding a current failure. When a new commit supersedes an older PR run, cancel the obsolete run and validate the newest head.
