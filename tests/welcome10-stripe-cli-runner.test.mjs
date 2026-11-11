// Safe offline smoke for Stripe CLI local runner. No CLI, Auth or Stripe API called.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
const path = "scripts/qa/welcome10-stripe-cli-run.mjs";
test("Stripe CLI test runner parses and dry-run never contacts Stripe", () => {
  const check = spawnSync(process.execPath, ["--check", path], { encoding: "utf8" });
  assert.equal(check.status, 0, check.stderr);
  const dry = spawnSync(process.execPath, [path], {
    encoding: "utf8", timeout: 5000,
    env: { ...process.env, STRIPE_API_KEY: "", STRIPE_SECRET_KEY: "", STRIPE_TEST_API_KEY: "" },
  });
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stdout, /DRY RUN ONLY/);
  assert.match(dry.stdout, /no Stripe API calls/);
});
test("Stripe CLI local runner rejects accidentally inherited live Stripe key", () => {
  const live = spawnSync(process.execPath, [path], {
    encoding: "utf8", timeout: 5000,
    env: {
      ...process.env,
      STRIPE_API_KEY: "sk_live_SYNTHETIC_TEST_NO_REAL_KEY",
      STRIPE_SECRET_KEY: "",
      STRIPE_TEST_API_KEY: "",
    },
  });
  assert.notEqual(live.status, 0);
  assert.match(live.stderr, /Refusing non-test Stripe credentials/);
});
test("Genuine Stripe delivery and actual business reconciliation are never conflated", () => {
  const runner = readFileSync(path, "utf8");
  const receiver = readFileSync("scripts/qa/welcome10-stripe-cli-receiver.mjs", "utf8");
  assert.match(runner, /genuine CLI signed delivery/);
  assert.match(runner, /actualDbReconciliation = "BLOCKED/);
  assert.match(receiver, /nonMutating: true/);
  assert.match(receiver, /seenIds/);
  assert.match(receiver, /Stripe.*sandbox|Stripe sandbox/i);
  assert.doesNotMatch(runner, /--live"/);
});
