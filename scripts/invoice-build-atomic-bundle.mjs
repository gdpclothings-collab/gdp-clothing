/**
 * Build the exact GDP Clothing invoice-only atomic release bundle.
 * Zero external dependencies. This tool DOES NOT connect to Supabase.
 * Usage: node scripts/invoice-build-atomic-bundle.mjs <output-directory>
 *
 * A production release may use the generated SQL ONLY after an explicit
 * deployment authorization and a verified restore plan. Do not run
 * the source migrations individually against production.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

export const invoiceMigrationNames = Object.freeze([
  "20261010021500_admin_invoice_ledger.sql",
  "20261010173000_invoice_draft_metadata.sql",
  "20261010181000_atomic_manual_drafts.sql",
  "20261010193000_invoice_document_draft_meta.sql",
  "20261010194000_snapshot_invoice_document_meta.sql",
  "20261010210000_atomic_complete_invoice_draft.sql",
  "20261011004000_invoice_layout_payment_due.sql",
  "20261011010000_reserve_draft_invoice_number.sql",
  "20261011021000_issue_admin_draft_direct.sql",
  "20261011033000_invoice_issuance_strict_aal2.sql",
  "20261011043000_invoice_issued_terms_snapshot.sql",
]);

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

export function buildInvoiceBundle() {
  const sources = invoiceMigrationNames.map((name) => {
    const sql = readFileSync(resolve(root, "supabase", "migrations", name), "utf8");
    if (sql.length < 200) throw new Error("Missing/truncated invoice migration: " + name);
    if (/^\s*(?:BEGIN|COMMIT|ROLLBACK)\s*;/im.test(sql)) {
      throw new Error("Nested transaction boundary in migration " + name);
    }
    return { name, sha256: sha256(sql), bytes: Buffer.byteLength(sql), sql };
  });
  if (sources.length !== 11) throw new Error("Refusing incomplete migration bundle");
  const finalSql = sources.at(-1).sql;
  const strictSql = sources.at(-2).sql;
  if (
    !/coalesce\(auth\.jwt\(\)->>'aal','aal1'\) <> 'aal2'/.test(finalSql)
    || !/coalesce\(auth\.jwt\(\)->>'aal','aal1'\) <> 'aal2'/.test(strictSql)
    || !finalSql.includes("'invoice_due_date',v_order.invoice_due_date")
    || !finalSql.includes("'invoice_payment_terms',v_order.invoice_payment_terms")
    || !strictSql.includes("issue_admin_invoice_from_draft")
  ) throw new Error("Final AAL2 or issued-document snapshot safeguards are missing");
  // A true single-transaction package. No migration from outside this allowlist.
  const sql = [
    "-- GDP Clothing invoice schema release. One atomic transaction.",
    "-- Generated from the exact 11 migration inputs in invoice-atomic-manifest.json.",
    "-- NEVER run without verified backup and explicit production authorization.",
    "BEGIN;",
    ...sources.flatMap(({ name, sha256: digest, sql: content }) => [
      "\n-- >>> BEGIN " + name + " sha256=" + digest,
      content.trimEnd(),
      "-- <<< END " + name + "\n",
    ]),
    "COMMIT;",
    "",
  ].join("\n");
  const manifest = {
    purpose: "GDP Clothing invoice-only atomic schema deployment",
    sourceCount: sources.length,
    migrationNames: sources.map(({ name }) => name),
    files: sources.map(({ name, sha256: digest, bytes }) => ({ name, sha256: digest, bytes })),
    bundleSha256: sha256(sql),
    atomic: true,
    productionApplied: false,
    requiresExplicitApproval: true,
  };
  return { sql, manifest };
}

export function writeInvoiceBundle(outdir) {
  const target = resolve(outdir);
  mkdirSync(target, { recursive: true });
  const { sql, manifest } = buildInvoiceBundle();
  const sqlPath = join(target, "invoice-atomic-bundle.sql");
  const manifestPath = join(target, "invoice-atomic-manifest.json");
  writeFileSync(sqlPath, sql, { encoding: "utf8", flag: "w" });
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", { encoding: "utf8", flag: "w" });
  return { sqlPath, manifestPath, manifest };
}

if (isMain) {
  if (process.argv.length !== 3) {
    console.error("Usage: node scripts/invoice-build-atomic-bundle.mjs <output-directory>");
    process.exitCode = 2;
  } else {
    const { sqlPath, manifestPath, manifest } = writeInvoiceBundle(process.argv[2]);
    console.log("Invoice-only atomic bundle prepared (NOT DEPLOYED).");
    console.log("SQL: " + sqlPath);
    console.log("Manifest: " + manifestPath);
    console.log("Migrations: " + manifest.sourceCount + "; SHA-256: " + manifest.bundleSha256);
  }
}
