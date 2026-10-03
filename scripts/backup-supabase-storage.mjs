import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_BUCKETS = [
  "artwork-production",
  "customer-uploads",
  "design-proofs",
  "dtf-artwork",
  "product-images",
];

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log(`GDP Clothing Supabase Storage backup\n\nUsage:\n  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/backup-supabase-storage.mjs\n\nOptional environment variables:\n  BACKUP_OUTPUT_DIR=/secure/path\n  BACKUP_BUCKETS=artwork-production,customer-uploads\n\nThe default output is ./backups/supabase-storage-<timestamp>. The backups/ directory is gitignored.\nNever commit customer artwork or service-role credentials to GitHub.`);
  process.exit(0);
}

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const requestedBuckets = (process.env.BACKUP_BUCKETS || DEFAULT_BUCKETS.join(","))
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputRoot = path.resolve(
  process.env.BACKUP_OUTPUT_DIR || path.join("backups", `supabase-storage-${timestamp}`),
);

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function resolveSafeTarget(root, relativePath) {
  const target = path.resolve(root, ...relativePath.split("/"));
  const rootPrefix = `${path.resolve(root)}${path.sep}`;
  if (target !== path.resolve(root) && !target.startsWith(rootPrefix)) {
    throw new Error(`Unsafe Storage object path rejected: ${relativePath}`);
  }
  return target;
}

async function listFolder(bucket, prefix = "") {
  const entries = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit,
      offset,
      sortBy: { column: "name", order: "asc" },
    });

    if (error) throw new Error(`Unable to list ${bucket}/${prefix}: ${error.message}`);
    const page = data || [];
    entries.push(...page);
    if (page.length < limit) break;
    offset += page.length;
  }

  return entries;
}

async function backupFolder(bucket, bucketRoot, manifest, prefix = "") {
  const entries = await listFolder(bucket, prefix);

  for (const entry of entries) {
    const objectPath = prefix ? `${prefix}/${entry.name}` : entry.name;

    // Supabase folder placeholders returned by list() do not have a file id.
    if (!entry.id) {
      await backupFolder(bucket, bucketRoot, manifest, objectPath);
      continue;
    }

    const { data, error } = await supabase.storage.from(bucket).download(objectPath);
    if (error) throw new Error(`Unable to download ${bucket}/${objectPath}: ${error.message}`);

    const bytes = Buffer.from(await data.arrayBuffer());
    const target = resolveSafeTarget(bucketRoot, objectPath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, bytes);

    manifest.objects.push({
      bucket,
      path: objectPath,
      bytes: bytes.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      updated_at: entry.updated_at || null,
    });
  }
}

async function main() {
  await fs.mkdir(outputRoot, { recursive: true, mode: 0o700 });

  const manifest = {
    created_at: new Date().toISOString(),
    source: supabaseUrl,
    buckets: requestedBuckets,
    objects: [],
  };

  for (const bucket of requestedBuckets) {
    const bucketRoot = path.join(outputRoot, bucket);
    await fs.mkdir(bucketRoot, { recursive: true });
    console.log(`Backing up ${bucket}...`);
    await backupFolder(bucket, bucketRoot, manifest);
  }

  const manifestPath = path.join(outputRoot, "manifest.json");
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });

  const totalBytes = manifest.objects.reduce((sum, object) => sum + object.bytes, 0);
  console.log(`Backup complete: ${manifest.objects.length} objects, ${totalBytes} bytes.`);
  console.log(`Manifest: ${manifestPath}`);
  console.log("Copy this backup to an encrypted/offsite location; do not commit it to GitHub.");
}

main().catch((error) => {
  console.error("Storage backup failed:", error?.message || error);
  process.exit(1);
});
