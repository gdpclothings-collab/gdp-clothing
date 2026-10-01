import fs from "node:fs";

const workflow = fs.readFileSync(".github/workflows/safe-auto-merge.yml", "utf8");
const productionSmoke = fs.readFileSync(".github/workflows/production-smoke.yml", "utf8");

function requireText(source, needle, label) {
  if (!source.includes(needle)) {
    throw new Error(`Missing safe auto-merge contract: ${label}`);
  }
}

for (const check of [
  "Cloudflare Pages",
  "standalone-build",
  "static-quality",
  "Browser secret guard",
  "CodeQL",
]) {
  requireText(workflow, `\"${check}\"`, `required check ${check}`);
}

requireText(workflow, "actions: write", "workflow can dispatch post-merge Production Smoke");
requireText(workflow, 'mergeable="$(jq -r \' .mergeable\' '.replaceAll(" ", ""), "actual GitHub mergeable boolean is checked");
requireText(workflow, '"${mergeable}" == "true"', "merge requires mergeable=true");
requireText(workflow, '"${mergeable_state}" == "clean" || "${mergeable_state}" == "unstable"', "self-check unstable state is allowed only after required checks pass");
requireText(workflow, '"${mergeable_state}" == "dirty"', "conflicts remain blocked");
requireText(workflow, '"${mergeable_state}" == "blocked"', "blocked state remains rejected");
requireText(workflow, '"${mergeable_state}" == "behind"', "behind state remains rejected");
requireText(workflow, '--match-head-commit "${EXPECTED_SHA}"', "merge stays pinned to verified PR head");
requireText(workflow, 'current_sha="$(jq -r \' .head.sha\' '.replaceAll(" ", ""), "head SHA is rechecked before merge");
requireText(workflow, "Dispatch production smoke for merged commit", "auto-merge owns the post-merge production gate");
requireText(workflow, "merge_commit_sha", "post-merge smoke resolves exact merge SHA");
requireText(workflow, 'current_main_sha="$(gh api "repos/${REPOSITORY}/git/ref/heads/main" --jq \'.object.sha\')"', "dispatch is skipped when a newer main commit already owns smoke");
requireText(workflow, "gh workflow run production-smoke.yml", "Production Smoke is explicitly dispatched after GITHUB_TOKEN merge");
requireText(workflow, '-f expected_sha="${merged_sha}"', "dispatch pins Production Smoke to exact merged SHA");

requireText(productionSmoke, "expected_sha:", "Production Smoke accepts an exact merged SHA");
requireText(productionSmoke, "SMOKE_EXPECTED_SHA: ${{ github.event.inputs.expected_sha || github.sha }}", "Production Smoke records exact target SHA");
requireText(productionSmoke, "ref: ${{ github.event.inputs.expected_sha || github.sha }}", "Production Smoke checks out exact target SHA");
requireText(productionSmoke, "Verify smoke commit identity", "Production Smoke rejects checkout mismatch");
requireText(productionSmoke, "commits/${SMOKE_EXPECTED_SHA}/check-runs", "Cloudflare readiness is checked for exact target SHA");
requireText(productionSmoke, "github.event_name == 'push' || github.event_name == 'workflow_dispatch'", "dispatched smoke waits for production deployment");

if (workflow.includes('mergeable_state}" != "clean"')) {
  throw new Error("Legacy clean-only mergeability check would recreate the self-check deadlock.");
}

console.log("Safe auto-merge and post-merge Production Smoke handling verified.");
