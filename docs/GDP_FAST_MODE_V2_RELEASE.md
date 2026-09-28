# FAST MODE v2 release completion

The rollout release is complete only after the production smoke for the deployed rollout commit succeeds. If a final smoke assertion fails, return directly to blocker recovery and keep the rollout below 100%.
