import fs from "node:fs";

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function addNotificationImport(source) {
  const importPattern = /import\s*\{([^}]*)\}\s*from\s*["']@\/lib\/NotificationContext["'];?/;
  const match = source.match(importPattern);
  if (match) {
    const names = match[1]
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);
    if (!names.includes("requestNotification")) names.push("requestNotification");
    return source.replace(match[0], `import { ${names.join(", ")} } from "@/lib/NotificationContext";`);
  }

  return 'import { requestNotification } from "@/lib/NotificationContext";\n' + source;
}

const migrated = [];
for (const path of walk("src")) {
  if (!/\.(?:js|jsx|ts|tsx)$/.test(path)) continue;
  let source = fs.readFileSync(path, "utf8");
  if (!/window\.alert\s*\(/.test(source)) continue;

  source = addNotificationImport(source);
  source = source.replace(/window\.alert\s*\(/g, "requestNotification(");
  fs.writeFileSync(path, source);
  migrated.push(path);
}

const remaining = [];
for (const path of walk("src")) {
  if (!/\.(?:js|jsx|ts|tsx)$/.test(path)) continue;
  const source = fs.readFileSync(path, "utf8");
  if (/window\.(?:alert|confirm)\s*\(/.test(source)) remaining.push(path);
}

if (remaining.length) {
  throw new Error(`Native browser dialogs remain in: ${remaining.join(", ")}`);
}

console.log(`Migrated native alerts in ${migrated.length} files.`);
console.log("No window.alert or window.confirm calls remain in src/.");
