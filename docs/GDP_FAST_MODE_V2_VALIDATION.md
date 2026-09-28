# FAST MODE v2 rollout validation

The rollout PR itself must pass the repository's existing validation. The new policy-check workflow additionally verifies representative GREEN, YELLOW and RED classifier contracts. After safe merge, the deployed main commit must pass production smoke before the rollout is considered complete.
