# FAST MODE one-PR path

For a normal scoped implementation, prefer one focused branch and one PR. Keep the diff limited to the requested feature/fix plus directly related tests/workflow changes. Validate once per current head, repair blockers on that branch, and merge only when the required tier gates pass. Avoid unrelated cleanup that expands the regression surface.
