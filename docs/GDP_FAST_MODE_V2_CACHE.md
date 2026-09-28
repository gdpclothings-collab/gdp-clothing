# FAST MODE cache optimization

Dependency and browser caching are performance optimizations, not correctness gates. Use them when they are compatible with the runner and lockfile/version inputs. A cache miss must fall back to a clean deterministic install rather than failing production validation.
