import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  buildInvoiceBundle,
  invoiceMigrationNames,
} from "./invoice-build-atomic-bundle.mjs";

const checksum = (s) => createHash("sha256").update(s).digest("hex");

test("atomic package includes exactly 11 allowlisted invoice SQL files in timestamp order", () => {
  const { sql, manifest } = buildInvoiceBundle();
  assert.equal(manifest.atomic, true);
  assert.equal(manifest.sourceCount, 11);
  assert.deepEqual(manifest.migrationNames, invoiceMigrationNames);
  assert.deepEqual([...invoiceMigrationNames].sort(), invoiceMigrationNames);
  assert.ok(sql.startsWith("-- GDP Clothing invoice schema release. One atomic transaction."));
  assert.ok(sql.includes("\nBEGIN;\n"));
  assert.ok(sql.endsWith("\nCOMMIT;\n"));
  assert.equal(checksum(sql), manifest.bundleSha256);
  assert.equal((sql.match(/-- >>> BEGIN \d{14}_.*\.sql sha256=/g) || []).length, 11);
  assert.equal((sql.match(/-- <<< END \d{14}_.*\.sql/g) || []).length, 11);
});

test("bundle manifest matches source bytes and hashes (no implicit historical SQL)", () => {
  const { sql, manifest } = buildInvoiceBundle();
  for (const file of manifest.files) {
    const source = readFileSync(resolve("supabase","migrations",file.name),"utf8");
    assert.equal(checksum(source), file.sha256, file.name);
    assert.equal(Buffer.byteLength(source), file.bytes, file.name);
    assert.ok(sql.includes("-- >>> BEGIN " + file.name + " sha256=" + file.sha256));
    assert.ok(sql.includes(source.trimEnd()));
    assert.ok(file.name.startsWith("20261010") || file.name.startsWith("20261011"));
  }
});

test("final issuer in atomic package enforces MFA AAL2 and frozen financial terms", () => {
  const { sql } = buildInvoiceBundle();
  const final = sql.slice(sql.lastIndexOf("-- >>> BEGIN 20261011043000_"));
  assert.match(final, /coalesce\(auth\.jwt\(\)->>'aal','aal1'\) <> 'aal2'/);
  assert.match(final, /'invoice_due_date',v_order\.invoice_due_date/);
  assert.match(final, /'invoice_payment_terms',v_order\.invoice_payment_terms/);
  assert.match(final, /for update/);
  assert.match(final, /grant execute on function public\.issue_admin_order_invoice\(uuid\) to authenticated/);
});
