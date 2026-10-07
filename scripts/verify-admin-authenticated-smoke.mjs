import fs from "node:fs";

const smoke = fs.readFileSync("scripts/admin-authenticated-smoke.mjs", "utf8");
const workflow = fs.readFileSync(".github/workflows/production-smoke.yml", "utf8");

function requireText(source, needle, label) {
  if (!source.includes(needle)) {
    throw new Error(`Missing authenticated admin smoke contract: ${label}`);
  }
}

for (const [needle, label] of [
  ["GDP_ADMIN_SMOKE_EMAIL", "dedicated admin smoke email"],
  ["GDP_ADMIN_SMOKE_PASSWORD", "dedicated admin smoke password"],
  ["GDP_ADMIN_SMOKE_TOTP_SECRET", "optional dedicated TOTP secret"],
  ['getByRole("dialog", { name: "GDP admin search" })', "Global Search dialog check"],
  ['getByRole("button", { name: "Quick Actions" })', "mobile Quick Actions trigger check"],
  ['getByRole("menu", { name: "Admin quick actions" })', "mobile Quick Actions menu check"],
  ['aria-current', "selected navigation semantics check"],
  ['Horizontal overflow', "mobile overflow check"],
]) {
  requireText(smoke, needle, label);
}

for (const [needle, label] of [
  ["GDP_ADMIN_SMOKE_EMAIL: ${{ secrets.GDP_ADMIN_SMOKE_EMAIL }}", "email secret wiring"],
  ["GDP_ADMIN_SMOKE_PASSWORD: ${{ secrets.GDP_ADMIN_SMOKE_PASSWORD }}", "password secret wiring"],
  ["GDP_ADMIN_SMOKE_TOTP_SECRET: ${{ secrets.GDP_ADMIN_SMOKE_TOTP_SECRET }}", "TOTP secret wiring"],
  ["Run authenticated admin smoke", "production smoke step"],
  ["node scripts/admin-authenticated-smoke.mjs", "admin smoke execution"],
]) {
  requireText(workflow, needle, label);
}

if (
  workflow.includes('GDP_ADMIN_SMOKE_PASSWORD: "') ||
  workflow.includes('GDP_ADMIN_SMOKE_TOTP_SECRET: "')
) {
  throw new Error("Admin smoke credentials must never be hard-coded in the workflow.");
}

console.log("Authenticated admin smoke wiring verified.");
