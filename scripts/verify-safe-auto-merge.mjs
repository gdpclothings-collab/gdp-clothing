import fs from "node:fs";

const workflow = fs.readFileSync(".github/workflows/safe-auto-merge.yml", "utf8");

function requireText(needle, label) {
  if (!workflow.includes(needle)) {
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
  requireText(`\"${check}\"`, `required check ${check}`);
}

requireText('mergeable="$(jq -r \'.mergeable\'', "actual GitHub mergeable boolean is checked");
requireText('"${mergeable}" == "true"', "merge requires mergeable=true");
requireText('"${mergeable_state}" == "clean" || "${mergeable_state}" == "unstable"', "self-check unstable state is allowed only after required checks pass");
requireText('"${mergeable_state}" == "dirty"', "conflicts remain blocked");
requireText('"${mergeable_state}" == "blocked"', "blocked state remains rejected");
requireText('"${mergeable_state}" == "behind"', "behind state remains rejected");
requireText('--match-head-commit "${EXPECTED_SHA}"', "merge stays pinned to verified PR head");
requireText('current_sha="$(jq -r \'.head.sha\'', "head SHA is rechecked before merge");

if (workflow.includes('mergeable_state}" != "clean"')) {
  throw new Error("Legacy clean-only mergeability check would recreate the self-check deadlock.");
}

console.log("Safe auto-merge self-check handling verified.");
