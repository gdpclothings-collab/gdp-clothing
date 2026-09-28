# FAST MODE performance measurement

Measure where CI time is spent before replacing setup steps. Current production-smoke evidence shows dependency and Playwright/browser setup is a meaningful portion of runtime. Optimize it through verified caching or runner-image reuse only after confirming clean fallback behavior.
