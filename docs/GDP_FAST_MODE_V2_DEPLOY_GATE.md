# Rollout deploy gate

The production deployment must correspond to the merged main commit. Verify Cloudflare success before interpreting the production smoke result. If deployment fails, treat that as the current blocker rather than running smoke against an older production build.
