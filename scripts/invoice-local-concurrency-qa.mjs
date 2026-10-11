/**
 * GDP Clothing -- local Supabase concurrent invoice-issuance QA.
 * Run from Windows PowerShell:
 *   node .\scripts\invoice-local-concurrency-qa.mjs
 *
 * Uses ONLY the Docker container supabase_db_gdp-clothing.
 * Clones local PostgreSQL to a unique throwaway database. Does not mutate
 * the source database. Deletes the clone, backup and files in finally.
 */
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";

const CONTAINER = "supabase_db_gdp-clothing";
const RESTORE_ROLE = "supabase_admin";
const token = randomBytes(4).toString("hex");
const database = "gdp_invoice_qa_" + token;
const backupPath = "/tmp/gdp_invoice_qa_" + token + ".dump";
const remoteSqlPrefix = "/tmp/gdp_invoice_qa_" + token;
const localDir = dirname(fileURLToPath(import.meta.url));
const testFiles = [
  ["invoice-concurrency-setup.sql", remoteSqlPrefix + "_setup.sql"],
  ["invoice-concurrency-worker.sql", remoteSqlPrefix + "_worker.sql"],
  ["invoice-concurrency-check.sql", remoteSqlPrefix + "_check.sql"],
];
let databaseCreated = false;
let failed = false;

function execDocker(args, task, { silent = false, allowFailure = false } = {}) {
  const result = spawnSync("docker", args, {
    encoding: "utf8",
    windowsHide: true,
    timeout: 180000,
    maxBuffer: 4 * 1024 * 1024,
  });
  const output = (result.stdout || "") + "\n" + (result.stderr || "");
  if (result.error || result.status !== 0) {
    if (allowFailure) return false;
    // pg_restore can print a multi-page CREATE FUNCTION after an error.
    // Report the actual PostgreSQL error lines rather than the SQL tail.
    const lines = output.split(/\r?\n/);
    const diagnostic = lines
      .filter((line) => /^(?:pg_restore: error:|pg_dump: error:|psql:.*ERROR:|ERROR:|FATAL:|DETAIL:|HINT:|pgbench: error:|createdb: error:|dropdb: error:)/i.test(line.trim()))
      .slice(0, 8)
      .map((line) => line.trim());
    const detail = result.error?.message
      || (diagnostic.length ? diagnostic.join("\n") : output.trim().slice(0, 1400))
      || ("exit code " + result.status);
    throw new Error(task + " failed (exit " + result.status + "):\n" + detail);
  }
  if (!silent && output.trim()) console.log(output.trim());
  return true;
}

function dockerInside(args, task, options) {
  return execDocker(["exec", CONTAINER, ...args], task, options);
}

try {
  console.log("GDP invoice concurrency QA -- isolated local test (no production)");
  const running = spawnSync("docker", [
    "inspect", "--format", "{{.State.Running}}", CONTAINER,
  ], { encoding: "utf8", windowsHide: true });
  if (running.status !== 0 || running.stdout.trim() !== "true") {
    throw new Error("Local Docker database container " + CONTAINER + " must be running.");
  }

  dockerInside(["sh", "-lc", "command -v pgbench >/dev/null && command -v pg_dump >/dev/null && command -v pg_restore >/dev/null"], "Postgres test-tool preflight", { silent: true });
  // In the Supabase development image, postgres often cannot set superuser
  // configuration values found in pg_dump function definitions. Use the
  // existing local supabase_admin role ONLY for the disposable clone.
  // Do not change grants, roles, or server settings in the source database.
  const privilegeProbe = spawnSync("docker", [
    "exec", CONTAINER, "psql", "-X", "-w", "-At", "-U",
    RESTORE_ROLE, "-d", "postgres",
    "-c", "SELECT rolsuper FROM pg_roles WHERE rolname = current_user",
  ], { encoding: "utf8", windowsHide: true, timeout: 12000 });
  if (privilegeProbe.status !== 0 || privilegeProbe.stdout.trim() !== "t") {
    throw new Error("A local superuser connection as supabase_admin is unavailable. Cannot safely restore a full Supabase database clone. No test database was created.");
  }
  console.log("PASS: local-only privileged restore role verified (no roles or settings modified).");
  for (const [file] of testFiles) {
    if (!existsSync(resolve(localDir, file))) {
      throw new Error("Missing test file: " + file + ". Run git pull --ff-only first.");
    }
  }
  console.log("[1/6] Backing up the LOCAL postgres database inside Docker...");
  dockerInside(["pg_dump", "-U", "postgres", "-d", "postgres", "-Fc", "-f", backupPath], "Local database snapshot", { silent: true });

  console.log("[2/6] Creating temporary isolated test database...");
  dockerInside(["createdb", "-U", "postgres", database], "Create QA database", { silent: true });
  databaseCreated = true;
  dockerInside(["pg_restore", "-U", RESTORE_ROLE, "-d", database, "--no-owner", "--no-acl", "--exit-on-error", backupPath], "Restore cloned QA database", { silent: true });

  console.log("[3/6] Installing fictional invoice and temporary delay in clone...");
  for (const [file, target] of testFiles) {
    execDocker(["cp", resolve(localDir, file), CONTAINER + ":" + target], "Copy " + file, { silent: true });
  }
  dockerInside(["psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", RESTORE_ROLE, "-d", database, "-f", testFiles[0][1]], "Create QA fixture");

  console.log("[4/6] Issuing same draft from TWO simultaneous database clients...");
  dockerInside(["pgbench", "-n", "-c", "2", "-j", "2", "-t", "1", "-f", testFiles[1][1], "-U", RESTORE_ROLE, "-d", database], "Concurrent invoice requests");

  console.log("[5/6] Verifying overlapping calls and a single immutable invoice...");
  dockerInside(["psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", RESTORE_ROLE, "-d", database, "-f", testFiles[2][1]], "Validate concurrency result");
  console.log("PASS: two concurrent issuance calls produced exactly one invoice.");
} catch (error) {
  failed = true;
  console.error("QA BLOCKED / FAILED: " + error.message);
} finally {
  console.log("[6/6] Removing temporary test database and snapshot...");
  if (databaseCreated) {
    const dropped = dockerInside(["dropdb", "-U", "postgres", "--if-exists", "--force", database], "Remove isolated QA database", { silent: true, allowFailure: true });
    if (!dropped) {
      failed = true;
      console.error("CLEANUP INCOMPLETE: temporary database " + database + " could not be dropped. Delete the local-only clone before continuing.");
    } else {
      console.log("PASS: temporary test database removed.");
    }
  }
  const targets = [backupPath, ...testFiles.map(([, remote]) => remote)];
  const removedFiles = dockerInside(["rm", "-f", ...targets], "Delete local QA backup and scripts", { silent: true, allowFailure: true });
  if (!removedFiles) {
    failed = true;
    console.error("CLEANUP INCOMPLETE: inspect and delete /tmp/gdp_invoice_qa_* files inside local Docker.");
  } else {
    console.log("PASS: backup and temporary test files removed.");
  }
  if (!failed) console.log("FINAL RESULT: CONCURRENT ISSUANCE QA PASSED (local only).");
  else {
    console.error("FINAL RESULT: QA NOT VERIFIED -- do NOT approve invoice deployment.");
    process.exitCode = 1;
  }
}
