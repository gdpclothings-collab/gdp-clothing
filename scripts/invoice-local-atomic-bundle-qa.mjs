/**
 * GDP Clothing: all-or-nothing invoice migration QA.
 *
 * Run on local Windows PowerShell:
 *   node .\scripts\invoice-local-atomic-bundle-qa.mjs
 *
 * NEVER connects to hosted Supabase. The source local PostgreSQL database
 * is read by pg_dump only; all destructive resets happen in a disposable clone
 * with an unpredictable gdp_invoice_atomic_<hex> name. No credentials required.
 *
 * The test includes:
 *  - generate SHA256 manifest of 11 SQL source files (atomic BEGIN/COMMIT)
 *  - create invoice-FREE baseline in a disposable CLONE, never live local DB
 *  - inject SQL failure at the end of the transaction and verify FULL rollback
 *  - apply original atomic SQL bundle and assert strict final security guards
 *  - send two overlapping invoice RPC requests and compare return IDs/numbers
 *  - drop disposable clone and delete temporary files even on failure
 */
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { dirname, resolve, join } from "node:path";
import { mkdtempSync, existsSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { writeInvoiceBundle } from "./invoice-build-atomic-bundle.mjs";

const CONTAINER = "supabase_db_gdp-clothing";
const ACTOR = "supabase_admin";
const id = randomBytes(4).toString("hex");
const db = "gdp_invoice_atomic_" + id;
const prefix = "/tmp/gdp_invoice_atomic_" + id;
const localDir = dirname(fileURLToPath(import.meta.url));
let work = null;
let databaseCreated = false;
let failed = false;
const copied = [];
const dump = prefix + ".dump";

function command(args, label, { silent = false, allowFailure = false, timeout = 180000 } = {}) {
  const r = spawnSync("docker", args, { encoding: "utf8", windowsHide: true, timeout, maxBuffer: 8 * 1024 * 1024 });
  const output = ((r.stdout || "") + "\n" + (r.stderr || "")).trim();
  if (r.error || r.status !== 0) {
    if (allowFailure) return { ok: false, output, error: r.error, status: r.status };
    const lines = output.split(/\r?\n/).filter(line =>
      /(?:ERROR:|FATAL:|HINT:|DETAIL:|pg_restore: error:|pgbench: error:|createdb: error:|dropdb: error:)/i.test(line));
    throw new Error(label + " failed (exit " + r.status + "): " + (r.error?.message || lines.slice(0, 8).join("\n") || output.slice(-1400)));
  }
  if (!silent && output) console.log(output.slice(-3500));
  return { ok: true, output };
}
const exec = (args, label, opts) => command(["exec", CONTAINER, ...args], label, opts);
const copy = (filename, src) => {
  const dest = prefix + "_" + filename;
  command(["cp", src, CONTAINER + ":" + dest], "Copy " + filename, { silent: true });
  copied.push(dest);
  return dest;
};
const psql = (file, task, opts = {}) =>
  exec(["psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", ACTOR, "-d", db, "-f", file], task, opts);

try {
  console.log("GDP Clothing — atomic invoice bundle QA (LOCAL DISPOSABLE CLONE ONLY)");
  const health = command(["inspect", "--format", "{{.State.Running}}", CONTAINER], "Docker database inspect", { silent: true });
  if (health.output.trim() !== "true") throw new Error("The exact local Supabase Docker database is not running.");
  exec(["sh", "-lc", "command -v pgbench >/dev/null && command -v pg_dump >/dev/null && command -v pg_restore >/dev/null"], "Postgres tools preflight", { silent: true });
  const privilege = exec(["psql","-X","-w","-At","-U",ACTOR,"-d","postgres","-c","SELECT rolsuper FROM pg_roles WHERE rolname=current_user"],"Local restore-role check",{silent:true});
  if (privilege.output.trim() !== "t") throw new Error("The local restore role lacks superuser access; aborting.");
  console.log("PASS: isolated local database and privileged restore role checked");

  work = mkdtempSync(join(tmpdir(), "gdp-invoice-atomic-qa-"));
  const { sqlPath, manifestPath, manifest } = writeInvoiceBundle(work);
  if (manifest.sourceCount !== 11 || !manifest.atomic) throw new Error("Bundle missing required migrations.");
  const full = readFileSync(sqlPath, "utf8");
  if (!full.endsWith("COMMIT;\n")) throw new Error("Bundle does not end in one COMMIT.");
  const aborted = full.replace(/\nCOMMIT;\s*$/, "\nDO $failure$ BEGIN RAISE EXCEPTION 'GDP_ATOMIC_ROLLBACK_PROBE'; END $failure$;\nCOMMIT;\n");
  if (!aborted.includes("GDP_ATOMIC_ROLLBACK_PROBE")) throw new Error("Could not instrument rollback probe.");
  const abortPath = join(work, "invoice-atomic-intentional-abort.sql");
  writeFileSync(abortPath, aborted, "utf8");
  console.log("PASS: exact eleven migrations bundled; SHA256 " + manifest.bundleSha256);

  console.log("[1/7] Snapshot LOCAL database into Docker (source is read-only)...");
  exec(["pg_dump","-U","postgres","-d","postgres","-Fc","-f",dump],"Local snapshot",{silent:true,timeout:240000});
  console.log("[2/7] Restore disposable isolated clone...");
  exec(["createdb","-U","postgres",db],"Create disposable test database",{silent:true});
  databaseCreated = true;
  exec(["pg_restore","-U",ACTOR,"-d",db,"--no-owner","--no-acl","--exit-on-error",dump],"Restore isolated clone",{silent:true,timeout:240000});

  const filepaths = {};
  for(const name of [
    "invoice-atomic-clone-baseline.sql",
    "invoice-atomic-clone-verify-rollback.sql",
    "invoice-atomic-clone-verify-installed.sql",
    "invoice-concurrency-setup.sql",
    "invoice-concurrency-worker.sql",
    "invoice-concurrency-check.sql",
  ]) {
    const from = resolve(localDir,name);
    if(!existsSync(from)) throw new Error("Missing QA file: "+name+". Run git pull --ff-only.");
    filepaths[name] = copy(name,from);
  }
  const fullRemote = copy("full-bundle.sql",sqlPath);
  const abortRemote = copy("abort-bundle.sql",abortPath);

  console.log("[3/7] Remove invoice-only objects from disposable clone...");
  psql(filepaths["invoice-atomic-clone-baseline.sql"],"Prepare invoice-free baseline",{silent:true});
  console.log("[4/7] Inject SQL error before COMMIT; require ALL-OR-NOTHING rollback...");
  const probed = psql(abortRemote,"Intentional rollback probe",{silent:true,allowFailure:true,timeout:240000});
  if (probed.ok || !probed.output.includes("GDP_ATOMIC_ROLLBACK_PROBE"))
    throw new Error("Rollback injection did not produce the required expected SQL error: " + probed.output.slice(-700));
  psql(filepaths["invoice-atomic-clone-verify-rollback.sql"],"Verify nothing committed",{silent:false});
  console.log("[5/7] Apply all 11 migrations together in one database transaction...");
  psql(fullRemote,"Atomic invoice bundle application",{silent:true,timeout:240000});
  psql(filepaths["invoice-atomic-clone-verify-installed.sql"],"Verify final invoice security and snapshot",{silent:false});
  console.log("[6/7] Retest TWO simultaneous invoice requests against freshly installed schema...");
  psql(filepaths["invoice-concurrency-setup.sql"],"Prepare fictional concurrent order",{silent:true});
  exec(["pgbench","-n","-c","2","-j","2","-t","1","-f",filepaths["invoice-concurrency-worker.sql"],"-U",ACTOR,"-d",db],"Concurrent invoice requests");
  psql(filepaths["invoice-concurrency-check.sql"],"Verify single invoice and frozen due terms");
  console.log("PASS: migration rollback, fresh install and concurrent issuance on disposable clone.");
} catch (error) {
  failed = true;
  console.error("ATOMIC QA BLOCKED / FAILED: " + error.message);
} finally {
  console.log("[7/7] Cleaning up disposable database, backup and SQL...");
  if (databaseCreated) {
    const drop = exec(["dropdb","-U","postgres","--if-exists","--force",db],"Drop isolated database",{allowFailure:true,silent:true});
    if (drop.ok) console.log("PASS: disposable clone dropped.");
    else {
      failed = true;
      console.error("CLEANUP FAILED: could not drop " + db + "; delete this local QA database manually.");
    }
  }
  const files = [dump, ...copied];
  const remove = exec(["rm","-f",...files],"Clean Docker QA files",{allowFailure:true,silent:true});
  if(remove.ok) console.log("PASS: Docker temporary files removed.");
  else { failed = true; console.error("CLEANUP FAILED: temporary Docker files remain under " + prefix); }
  if(work) {
    try { rmSync(work,{recursive:true,force:true}); console.log("PASS: Windows temporary files removed."); }
    catch(e) { failed = true; console.error("Windows temp cleanup failed: " + e.message); }
  }
  if (!failed) console.log("FINAL RESULT: ATOMIC INVOICE BUNDLE QA PASSED (LOCAL ONLY; NOT DEPLOYED).");
  else { console.error("FINAL RESULT: ATOMIC INVOICE BUNDLE QA NOT VERIFIED; DO NOT DEPLOY."); process.exitCode=1; }
}
